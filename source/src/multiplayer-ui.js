import {RelayRoom, browserSocket} from './multiplayer.js';
import {multiplayerConfig} from './multiplayer-config.js';

export function showMultiplayer(app, {element: el, screen, home, partner}) {
  let room = app.coopRoom?.open ? app.coopRoom : null;
  let busy = false, error = '', message = '', starting = false, active = true, help = false;
  let pick = app.meta.profile.lastSpecies || 4;
  let name = localStorage.getItem('ziling.coop.name') || app.meta.account.name || '伙伴';
  let code = window.getCoopInvitation?.() || '';
  const button = (text, action, color = 'blue', disabled = false) => el('button', {
    class: 'btn ' + color, disabled: disabled || busy || starting, onclick: () => void act(action),
  }, text);
  const note = text => el('p', {class: 'lite-note'}, text);
  const row = (...children) => el('div', {class: 'lite-actions'}, ...children);
  async function act(action) {
    if (busy || starting) return;
    busy = true; error = ''; message = ''; render();
    try { await action(); } catch (err) { error = err.message || String(err); }
    finally { busy = false; if (active && !starting) render(); }
  }
  function bind() {
    room.ev = {
      change: () => { if (!starting && active) render(); },
      closed: reason => { app.coopRoom = null; room = null; error = reason; if (active && !starting) render(); },
      start: async state => {
        if (starting || !active) return;
        starting = true; const session = room; render();
        try {
          const ok = await app.startRun({species: session.mine.species, biome: 'forest', tier: state.tier,
            coop: {room: session, party: state.party, seed: state.seed}});
          if (!session.open) { app.toMenu(); app.notice('连接已断开，请重新组队'); active = false; return; }
          if (!ok) throw Error('森林未能打开，请返回首页后重新组队');
          active = false;
        } catch (err) {
          await session.leave(); app.coopRoom = null; room = null; starting = false; error = err.message; render();
        }
      },
    };
  }
  async function connect(join) {
    if (join && !/^\d{6}$/.test(code.trim())) throw Error('请输入六位房间号');
    name = name.trim() || '伙伴';
    localStorage.setItem('ziling.coop.name', name);
    app.coopConnecting = true;
    try {
      await window.prepareForest?.();
      room = await RelayRoom.connect({url: multiplayerConfig.url, code: join ? code.trim() : undefined, name, species: pick,
        factory: window.createCoopSocket || browserSocket});
      app.coopRoom = room; window.clearCoopInvitation?.(); bind();
    } finally { app.coopConnecting = false; }
  }
  async function leave() {
    active = false; await room?.leave(); app.coopRoom = null;
    window.clearCoopInvitation?.(); home(app);
  }
  async function copy() {
    if (window.copyCoopCode) await window.copyCoopCode(room.code);
    else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(room.code);
    else throw Error('请记下房间号 ' + room.code + '，告诉同一内网的朋友');
    message = '房间号已复制，让朋友进入「多人联机」粘贴加入。';
  }
  function invite() {
    if (!window.shareCoopRoom) { message = '先把游戏预览码发给朋友，再复制房间号给他。'; return; }
    window.shareCoopRoom(room.code);
    message = '在微信分享面板选择好友；分享不可用时，可发送预览码和房间号。';
  }
  async function paste() {
    if (!window.pasteCoopCode) throw Error('请手动输入朋友的六位房间号');
    code = await window.pasteCoopCode();
    message = '已填入房间号，点击「加入房间」。';
  }
  function render() {
    if (!active) return;
    pick = room?.mine?.species || pick;
    const choices = el('div', {class:'lite-actions coop-picks'}, ...[1,4,7].map(id => button((pick === id ? '✓ ' : '') + partner(id), async () => {
      if (room) await room.setPick(id); pick = id;
    }, pick === id ? 'red' : 'ghost')));
    const nodes = [el('div', {class: 'lite-map-head'}, el('b', {}, room ? '队伍房间 · ' + room.room.members.length + '/4 人' : '多人联机 · 2–4 人'),
      row(button(help ? '收起说明' : '怎么玩', () => { help = !help; }, 'ghost'), button(room ? '离开房间' : '返回首页', leave, 'ghost')))];
    if (starting) nodes.push(el('p', {class: 'lite-lead'}, '队伍已就绪，正在进入森林…'));
    else if (!room) {
      nodes.push(note('先连同一内网 Wi-Fi，再创建或加入房间。手机需要能访问内网服务器。'),
        el('div', {class: 'coop-columns'},
          el('section', {class: 'coop-section'}, el('b', {}, '我来组队'),
            el('input', {value: name, maxlength: 16, placeholder: '你的昵称', 'aria-label': '你的昵称',
              oninput: event => { name = event.target.value; }}),
            choices, row(button('创建房间', () => connect(false), 'red')), note('创建后邀请朋友，最多 4 人一起玩。')),
          el('section', {class: 'coop-section'}, el('b', {}, code ? '加入朋友的队伍' : '我有房间号'),
            el('input', {value: code, maxlength: 6, inputmode: 'numeric', placeholder: '六位房间号', 'aria-label': '六位房间号',
              oninput: event => { code = event.target.value.replace(/\D/g, '').slice(0,6); event.target.value = code; }}),
            row(button('粘贴房间号', paste, 'ghost'), button('加入房间', () => connect(true))),
            note(code ? '邀请已填好房间号，核对后点击加入。' : '先扫同一个游戏预览码，再输入房主的六位房间号。'),
            note('进房 → 选伙伴 → 每人准备 → 房主开始'))));
    } else {
      const waiting = room.room.members.filter(member => !member.ready);
      const status = room.room.members.length < 2 ? '还差 1 位伙伴，邀请朋友加入吧。' : waiting.length
        ? '还有 ' + waiting.length + ' 人未准备' + (room.mine?.ready ? '' : '，请先准备')
        : room.isHost ? '全员准备好了，点击「开始冒险」。' : '全员已准备，等待房主开始冒险。';
      nodes.push(el('div', {class: 'coop-columns'},
        el('section', {class: 'coop-section coop-invite'}, el('span', {class: 'lite-note'}, '六位房间号'),
          el('b', {class: 'coop-code'}, room.code),
          row(button('邀请好友', invite), button('复制房间号', copy, 'ghost')),
          note('朋友打开邀请加入；预览版先扫码，再填房间号。'),
          note('同一内网 · 开局后不能中途加入'),
          row(button('难度 ' + (room.room.tier + 1), () => room.setSettings('forest', (room.room.tier + 1) % 3), 'ghost', !room.isHost))),
        el('section', {class: 'coop-section'},
          el('div', {class: 'coop-members'}, ...room.room.members.map(member => el('div', {class: 'coop-member'},
            el('span', {}, (member.id === room.me ? '你 · ' : '') + (member.id === room.room.host ? '房主 · ' : '') + member.name + ' · ' + partner(member.species)),
            el('b', {style: {color: member.ready ? '#20805b' : '#826335'}}, member.ready ? '已准备' : '未准备'),
            ...(room.isHost && member.id !== room.me ? [button('移出', () => room.kick(member.id), 'ghost')] : [])))),
          choices, el('p', {class: 'coop-status', role: 'status'}, status),
          row(button(room.mine?.ready ? '取消准备' : '准备', () => room.setReady(!room.mine?.ready), room.mine?.ready ? 'ghost' : 'blue'),
            ...(room.isHost ? [button('开始冒险', () => room.start(), 'red', room.room.members.length < 2 || waiting.length > 0)] : [])))));
    }
    if (help) nodes.push(el('div', {class: 'coop-help'},
      el('b', {}, '一起玩，只需三步'),
      note('1. 每个人用微信打开同一份游戏预览版，连接能访问服务器的 Wi-Fi。'),
      note('2. 一个人创建房间，点「邀请好友」或「复制房间号」；朋友打开邀请或粘贴房间号加入。'),
      note('3. 每个人选伙伴并点「准备」，至少 2 人后，由房主点「开始冒险」。改伙伴或难度后要重新准备。'),
      el('b', {}, '战斗操作'),
      note('左侧按住拖动摇杆移动；右侧空白处拖动转动镜头。默认自动攻击，右侧按钮用于跳跃、冲刺和终极技。'),
      note('协作躲避怪物、拆字和收集经验，一起挑战森林首领。离开或断线后需重新组队；进度保存在各自手机。')));
    if (busy && !starting) nodes.push(note('正在处理，请稍候…'));
    if (message) nodes.push(el('p', {class: 'coop-status', role: 'status'}, message));
    if (error) nodes.push(el('p', {class: 'coop-error', role: 'alert'}, error));
    if (!room) nodes.push(note('左摇杆移动 · 右侧拖动镜头 · 自动攻击 · 每人准备后开局'));
    screen(app, 'lite-home coop-lan', el('section', {class: 'lite-panel coop-panel'}, ...nodes)).setAttribute('data-live-layout','');
  }
  if (room) bind(); render();
}
