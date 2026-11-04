// The relay owns membership, readiness and the shared world seed. Combat is
// simulated by the existing cooperative clients; this is a private play server.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode"

	"github.com/gorilla/websocket"
)

const buildID = "ziling-coop-1"
const maxPacket = 64 * 1024

type member struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Slot    int    `json:"slot"`
	Species int    `json:"species"`
	Ready   bool   `json:"ready"`
}
type room struct {
	Code    string    `json:"code"`
	Host    string    `json:"host"`
	State   string    `json:"state"`
	Biome   string    `json:"biome"`
	Tier    int       `json:"tier"`
	Version int       `json:"version"`
	Party   string    `json:"party"`
	Seed    int64     `json:"seed"`
	Members []*member `json:"members"`
	created time.Time
}
type message struct {
	Op       string          `json:"op"`
	ID       int             `json:"id"`
	Protocol int             `json:"protocol"`
	Build    string          `json:"build"`
	Code     string          `json:"code"`
	Name     string          `json:"name"`
	Species  int             `json:"species"`
	Ready    bool            `json:"ready"`
	Tier     int             `json:"tier"`
	To       string          `json:"to"`
	Data     json.RawMessage `json:"data"`
}
type packet struct {
	kind int
	data []byte
}
type client struct {
	id, ip string
	conn   *websocket.Conn
	send   chan packet
	done   chan struct{}
	once   sync.Once
	room   *room
	member *member
}

func (c *client) close() { c.once.Do(func() { close(c.done); c.conn.Close() }) }

// Never block all rooms on one slow device. Snapshots are disposable; reliable
// control messages disconnect a lagging client if its bounded queue is full.
func (c *client) queue(p packet) {
	select {
	case <-c.done:
		return
	default:
	}
	select {
	case c.send <- p:
	default:
		if p.kind != websocket.BinaryMessage {
			c.close()
		}
	}
}
func (c *client) json(v any) { b, _ := json.Marshal(v); c.queue(packet{websocket.TextMessage, b}) }
func (c *client) writer() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	defer c.close()
	for {
		select {
		case <-c.done:
			return
		case p := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if c.conn.WriteMessage(p.kind, p.data) != nil {
				return
			}
		case <-ticker.C:
			if c.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)) != nil {
				return
			}
		}
	}
}

type hub struct {
	mu       sync.Mutex
	clients  map[string]*client
	rooms    map[string]*room
	origins  map[string]bool
	stopping bool
}

func newHub(origins string) *hub {
	h := &hub{clients: map[string]*client{}, rooms: map[string]*room{}, origins: map[string]bool{}}
	for _, v := range strings.Split(origins, ",") {
		if v = strings.TrimSpace(v); v != "" {
			h.origins[v] = true
		}
	}
	return h
}
func randomHex() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func randomN(n int64) int64 {
	v, err := rand.Int(rand.Reader, big.NewInt(n))
	if err != nil {
		panic(err)
	}
	return v.Int64()
}
func validSpecies(n int) bool { return n == 1 || n == 4 || n == 7 }
func playerName(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	r := []rune(strings.TrimSpace(s))
	if len(r) > 16 {
		r = r[:16]
	}
	if len(r) == 0 {
		return "伙伴"
	}
	return string(r)
}
func (h *hub) broadcast(r *room) {
	r.Version++
	for _, m := range r.Members {
		if c := h.clients[m.ID]; c != nil {
			c.json(map[string]any{"op": "room", "room": r})
		}
	}
}
func (h *hub) remove(c *client) {
	r := c.room
	if r == nil {
		return
	}
	c.room = nil
	c.member = nil
	for i, m := range r.Members {
		if m.ID == c.id {
			r.Members = append(r.Members[:i], r.Members[i+1:]...)
			break
		}
	}
	if len(r.Members) == 0 {
		delete(h.rooms, r.Code)
		return
	}
	if r.Host == c.id {
		r.Host = r.Members[0].ID
	}
	h.broadcast(r)
}
func (h *hub) command(c *client, m message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	reply := func(err string) {
		out := map[string]any{"op": "reply", "id": m.ID}
		if err != "" {
			out["error"] = err
		} else {
			out["me"] = c.id
			if c.room != nil {
				out["room"] = c.room
			}
		}
		c.json(out)
	}
	if m.Op == "ping" {
		c.json(map[string]any{"op": "pong"})
		return
	}
	if m.Op == "create" || m.Op == "join" {
		if c.room != nil {
			reply("已经在房间中")
			return
		}
		if m.Protocol != 1 || m.Build != buildID {
			reply("游戏版本不一致，请所有人重新扫描同一版预览码")
			return
		}
		if !validSpecies(m.Species) {
			reply("请选择可用伙伴")
			return
		}
		var r *room
		if m.Op == "create" {
			if len(h.rooms) >= 64 {
				reply("房间已满，请稍后再试")
				return
			}
			code := ""
			for code == "" || h.rooms[code] != nil {
				code = ""
				for i := 0; i < 6; i++ {
					code += string(rune('0' + randomN(10)))
				}
			}
			r = &room{Code: code, Host: c.id, State: "lobby", Biome: "forest", Members: []*member{}, created: time.Now()}
			h.rooms[code] = r
		} else {
			r = h.rooms[strings.TrimSpace(m.Code)]
			if r == nil {
				reply("房间不存在，请检查六位房间号")
				return
			}
			if r.State != "lobby" {
				reply("房间已开局，请等本局结束后重新组队")
				return
			}
			if len(r.Members) >= 4 {
				reply("房间已满（最多四人）")
				return
			}
		}
		slot := 0
		for {
			used := false
			for _, v := range r.Members {
				if v.Slot == slot {
					used = true
				}
			}
			if !used {
				break
			}
			slot++
		}
		c.member = &member{ID: c.id, Name: playerName(m.Name), Slot: slot, Species: m.Species}
		c.room = r
		r.Members = append(r.Members, c.member)
		reply("")
		h.broadcast(r)
		return
	}
	r := c.room
	if r == nil {
		reply("请先创建或加入房间")
		return
	}
	if m.Op == "ctl" {
		if r.State != "started" || len(m.Data) == 0 || len(m.Data) > 32*1024 {
			return
		}
		var data map[string]json.RawMessage
		if json.Unmarshal(m.Data, &data) != nil || data["t"] == nil {
			return
		}
		for _, member := range r.Members {
			if member.ID != c.id && (m.To == "" || m.To == member.ID) {
				if peer := h.clients[member.ID]; peer != nil {
					peer.json(map[string]any{"op": "ctl", "from": c.id, "data": m.Data})
				}
			}
		}
		return
	}
	if m.Op == "leave" {
		h.remove(c)
		reply("")
		return
	}
	if r.State != "lobby" {
		reply("本局已开始，不能修改房间")
		return
	}
	switch m.Op {
	case "pick":
		if !validSpecies(m.Species) {
			reply("请选择可用伙伴")
			return
		}
		c.member.Species = m.Species
		c.member.Ready = false
	case "ready":
		c.member.Ready = m.Ready
	case "settings":
		if r.Host != c.id {
			reply("只有房主能修改难度")
			return
		}
		if m.Tier < 0 || m.Tier > 2 {
			reply("难度无效")
			return
		}
		r.Tier = m.Tier
		for _, v := range r.Members {
			v.Ready = false
		}
	case "kick":
		if r.Host != c.id || m.To == c.id {
			reply("只有房主能移出其他成员")
			return
		}
		peer := h.clients[m.To]
		if peer == nil || peer.room != r {
			reply("成员已离开")
			return
		}
		h.remove(peer)
		peer.json(map[string]any{"op": "closed", "reason": "你已被房主移出房间"})
	case "start":
		if r.Host != c.id {
			reply("只有房主能开始")
			return
		}
		if len(r.Members) < 2 {
			reply("至少两人才能开始")
			return
		}
		for _, v := range r.Members {
			if !v.Ready {
				reply("请等待所有成员准备")
				return
			}
		}
		r.Party = "lan-" + randomHex()
		r.Seed = randomN(2147483646) + 1
		r.State = "started"
	default:
		reply("未知操作")
		return
	}
	reply("")
	h.broadcast(r)
}
func (h *hub) binary(c *client, b []byte) {
	if len(b) < 2 || len(b) > maxPacket {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	r := c.room
	if r == nil || r.State != "started" {
		return
	}
	// First byte is the destination slot from the client, source slot from server.
	to := int(b[0])
	b[0] = byte(c.member.Slot)
	for _, m := range r.Members {
		if m.Slot == to && m.ID != c.id {
			if peer := h.clients[m.ID]; peer != nil {
				peer.queue(packet{websocket.BinaryMessage, b})
			}
			return
		}
	}
}
func (h *hub) originOK(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" || h.origins[origin] {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return u.Host == r.Host || u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost" || u.Hostname() == "servicewechat.com"
}
func (h *hub) serveWS(w http.ResponseWriter, r *http.Request) {
	// Count before upgrading, including sockets that have not joined a room.
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	h.mu.Lock()
	n := 0
	for _, c := range h.clients {
		if c.ip == ip {
			n++
		}
	}
	if h.stopping || len(h.clients) >= 256 || n >= 32 {
		h.mu.Unlock()
		http.Error(w, "Server busy", 503)
		return
	}
	u := websocket.Upgrader{HandshakeTimeout: 5 * time.Second, CheckOrigin: h.originOK, ReadBufferSize: 4096, WriteBufferSize: 4096}
	conn, err := u.Upgrade(w, r, nil)
	if err != nil {
		h.mu.Unlock()
		return
	}
	c := &client{id: randomHex(), ip: ip, conn: conn, send: make(chan packet, 64), done: make(chan struct{})}
	h.clients[c.id] = c
	h.mu.Unlock()
	go c.writer()
	defer func() { c.close(); h.mu.Lock(); h.remove(c); delete(h.clients, c.id); h.mu.Unlock() }()
	conn.SetReadLimit(maxPacket)
	conn.SetReadDeadline(time.Now().Add(45 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(45 * time.Second)) })
	window := time.Now()
	count, bytes := 0, 0
	joinedBy := time.Now().Add(20 * time.Second)
	for {
		kind, b, err := conn.ReadMessage()
		if err != nil {
			return
		}
		if time.Since(window) >= time.Second {
			window = time.Now()
			count = 0
			bytes = 0
		}
		count++
		bytes += len(b)
		if count > 240 || bytes > 2*1024*1024 {
			return
		}
		h.mu.Lock()
		unjoined := c.room == nil
		h.mu.Unlock()
		if unjoined && time.Now().After(joinedBy) {
			return
		}
		conn.SetReadDeadline(time.Now().Add(45 * time.Second))
		if kind == websocket.BinaryMessage {
			h.binary(c, b)
			continue
		}
		var m message
		if json.Unmarshal(b, &m) != nil {
			return
		}
		h.command(c, m)
	}
}
func (h *hub) health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	h.mu.Lock()
	defer h.mu.Unlock()
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "ziling-coop", "build": buildID, "rooms": len(h.rooms), "connections": len(h.clients)})
}
func (h *hub) shutdown() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.stopping = true
	for _, c := range h.clients {
		c.close()
	}
}
func (h *hub) expire() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, r := range h.rooms {
		if time.Since(r.created) > 6*time.Hour {
			for _, m := range r.Members {
				if c := h.clients[m.ID]; c != nil {
					c.close()
				}
			}
		}
	}
}
func main() {
	listen := flag.String("listen", ":8787", "listen address")
	origins := flag.String("origins", os.Getenv("ALLOWED_ORIGINS"), "additional allowed browser origins, comma separated")
	flag.Parse()
	h := newHub(*origins)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", h.serveWS)
	mux.HandleFunc("/healthz", h.health)
	srv := &http.Server{Addr: *listen, Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 8192}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				h.expire()
			}
		}
	}()
	go func() {
		<-ctx.Done()
		h.shutdown()
		timeout, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(timeout)
	}()
	log.Printf("字灵联机服务 %s，监听 %s；健康检查 /healthz", buildID, *listen)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
