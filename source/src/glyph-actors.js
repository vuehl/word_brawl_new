import { B as Attribute, H as InstancedMesh, ct as ShaderMaterial, et as PlaneGeometry, ft as TextureLoader, j as DynamicDrawUsage, ot as SRGBColorSpace, mt as Vector2 } from '../assets/three-DmSYIDKK.js';
import { GLYPHS } from './glyph-catalog.js';
import { GLYPH_ART, ATLAS_SIZE } from './glyph-art-data.js';
import { clamp, movementFor, samplePose } from './glyph-motion.js';
import { nextDamageStep } from './glyph-rules.js';

const CAPACITY = 3200, DEBRIS_LIMIT = 240;
// A body is always one connected drawing of a complete character. Only an
// explicitly authored subtraction may emit a separate stroke/radical.
export class GlyphActors {
  constructor(run, shaders) {
    this.run = run;
    this.states = new Map(); this.debris = [];
    this.time = run.time || 0; this.lastTime = this.time; this.count = 0; this.lastPopup = -10;
    this.stats = { hits: 0, breaks: 0, drawn: 0, peakDebris: 0 };
    this.ready = false; this.disposed = false;
    this.texture = new TextureLoader().load('/glyphs/semantic-atlas.png', texture => {
      if (this.disposed) { texture.dispose(); return; }
      this.ready = true;
    });
    this.texture.colorSpace = SRGBColorSpace;
    const geo = new PlaneGeometry(1, 1, 1, 8);
    this.attributes = {};
    for (const [name, size] of [['iPosition', 3], ['iShape', 4], ['iRegion', 4], ['iFx', 4], ['iTint', 4]]) {
      const attribute = new Attribute(new Float32Array(CAPACITY * size), size).setUsage(DynamicDrawUsage);
      this.attributes[name] = attribute; geo.setAttribute(name, attribute);
    }
    const shared = run.r.shared;
    this.material = new ShaderMaterial({
      defines: { GLYPH_INK: 1 },
      uniforms: { map: { value: this.texture }, uTexel: {value: new Vector2(1 / ATLAS_SIZE, 1 / ATLAS_SIZE)}, uLean: {value: .35},
        uLookPal: shaders.lookPal, uLight: shared.uLight, uTime: shared.uTime,
        uFogColor: shared.uFogColor, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
      vertexShader: `attribute vec3 iPosition; attribute vec4 iShape; attribute vec4 iRegion; attribute vec4 iFx; attribute vec4 iTint;
        uniform float uLean;
        varying vec2 vUv; varying vec4 vFx; varying vec4 vTint; varying float vFogDepth; varying vec4 vRect; varying vec2 vLocal; varying vec2 vLook;
        void main(){
          vec2 p=position.xy*iShape.xy;
          p.x+=sin(uv.y*3.14159265)*iShape.w*iShape.y;
          float c=cos(iShape.z),s=sin(iShape.z); p=vec2(p.x*c-p.y*s,p.x*s+p.y*c);
          vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
          vec3 camUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
          vec3 up=normalize(mix(vec3(0.,1.,0.),camUp,uLean));
          vec4 mv=viewMatrix*vec4(iPosition+right*p.x+up*p.y,1.);
          mv.z+=.25+iShape.y*.05; gl_Position=projectionMatrix*mv;
          vUv=mix(iRegion.xy,iRegion.zw,uv); vRect=iRegion; vLocal=uv;
          vFx=iFx; vTint=iTint; vLook=vec2(0.); vFogDepth=-mv.z;
        }`,
      // Reuse the game's actual lighting, color conversion, status tint and
      // elite/capture outlines, instead of inventing a different text palette.
      fragmentShader: shaders.fragmentShader, transparent: true,
    });
    this.mesh = new InstancedMesh(geo, this.material, CAPACITY);
    this.mesh.name = '字灵 · 完整字形与规范减字'; this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.renderOrder = 1; run.r.scene.add(this.mesh);
  }

  art(glyph, color) { return GLYPH_ART[glyph + color.toUpperCase()]; }
  entry(id) {
    const spec = GLYPHS[id];
    return spec ? { ...spec, kind: movementFor(spec.glyph), art: this.art(spec.glyph, spec.color) } : null;
  }
  begin() {
    this.time = this.run.time || 0;
    this.dt = clamp(this.time - this.lastTime, 0, .1); this.lastTime = this.time; this.count = 0;
    const e = this.run.enemies;
    for (const [id, state] of this.states) if (!e.alive[id] || state.gen !== e.gen[id]) this.states.delete(id);
  }
  state(id, species, gen) {
    let s = this.states.get(id);
    if (!s || s.gen !== gen || s.species !== species) {
      s = { species, gen, glyph: GLYPHS[species].glyph, step: 0, phase: id * 2.399, rollAngle: 0, poseTime: this.time,
        hitAt: -10, changedAt: -10, seenAt: -1 };
      this.states.set(id, s);
    }
    return s;
  }
  add(art, x, y, z, width, height, pose, fade = 0, tint = [1, 1, 1], tintStrength = 0, flash = 0, outline = 0) {
    if (!art || this.count >= CAPACITY || fade >= 1) return;
    const i = this.count++, a = this.attributes;
    a.iPosition.array.set([x, y, z], i * 3);
    a.iShape.array.set([width * pose.sx, height * pose.sy, pose.angle, pose.bend || 0], i * 4);
    a.iRegion.array.set(art.uv, i * 4); a.iFx.array.set([flash, fade, outline, 0], i * 4);
    a.iTint.array.set([...tint, tintStrength], i * 4);
  }
  enemy(index, x, z, sprite, tint, tintStrength, flash, fade, outline) {
    const e = this.run.enemies, entry = this.entry(e.species[index]);
    if (!this.ready || !entry?.art || this.count >= CAPACITY) return false;
    const s = this.state(index, e.species[index], e.gen[index]);
    if (e.dying[index] > 0) this.finish(index);
    if (s.finished) return true;
    const art = this.art(s.glyph, entry.color);
    const size = Math.max(.75, sprite.bodyHeight(e.scale[index]));
    const speed = Math.hypot(e.vx[index], e.vz[index]);
    const frozen = e.dying[index] > 0 || e.frozen[index] > 0 || e.sleep[index] > 0 || e.stun[index] > 0 || e.parked(index);
    const right = this.run.sprites.camRight;
    const dir = e.fx[index] * right.x + e.fz[index] * right.z < 0 ? -1 : 1;
    const moving = frozen ? 0 : clamp(speed / 3);
    if (s.seenAt !== this.time) {
      const elapsed = s.seenAt < 0 ? this.dt : clamp(this.time - s.seenAt, 0, .1);
      if (!frozen && this.time - s.hitAt > .055) {
        const advance = elapsed * (moving > .05 ? 7.5 + moving * 3 : entry.kind === 'roll' ? 0 : 1.8);
        s.phase += advance; s.rollAngle -= advance * dir; s.poseTime = this.time;
      }
      s.seenAt = this.time;
    }
    const options = {phase:s.phase, time:s.poseTime, rollAngle:s.rollAngle, moving, dir,
      attack:e.atkAnim[index] > 0 ? clamp(1 - e.atkAnim[index] / .4) : 0,
      hurt:clamp(1 - (this.time - s.hitAt) / .28)};
    const pose = samplePose(entry.kind, options);
    // Freeze the entire pose as well as the gait clock during status effects.
    if (frozen && s.pose) Object.assign(pose, s.pose);
    else s.pose = {...pose};
    const width = size * art.width / entry.art.height, height = size * art.height / entry.art.height;
    const halfExtent = (Math.abs(Math.sin(pose.angle)) * width * pose.sx + Math.abs(Math.cos(pose.angle)) * height * pose.sy) / 2;
    const center = {x:x + right.x * pose.dx * size, y:e.y[index] + halfExtent + pose.lift * size, z:z + right.z * pose.dx * size};
    s.last = { ...center, width, height, size, pose: {...pose} };
    this.add(art, center.x, center.y, center.z, width, height, pose, fade, tint, tintStrength, flash, outline);
    return true;
  }
  hit(index, damage, critical, info = {}) {
    if (!(damage > 0)) return;
    const e = this.run.enemies, entry = this.entry(e.species[index]);
    if (!entry) return;
    const s = this.state(index, e.species[index], e.gen[index]);
    if (s.finished) return;
    s.hitAt = this.run.time; this.stats.hits++;
    const step = nextDamageStep(entry.glyph, e.hp[index] / Math.max(1, e.maxHp[index]), s.step, critical);
    if (!step || this.run.time - s.changedAt < .16) return;
    this.detach(index, step, info);
  }
  // Called only for an actual death, never for a zero-HP capture target.
  // A one-stroke monster releases its one stroke here. Multi-stroke monsters
  // first lose a documented component, then their remaining intact glyph falls.
  finish(index) {
    const e=this.run.enemies,entry=this.entry(e.species[index]);
    if(!entry || !(e.dying[index]>0))return;
    const s=this.state(index,e.species[index],e.gen[index]);
    if(s.finished)return;
    if(s.step===0){
      const step=nextDamageStep(entry.glyph,0,0);
      if(step)this.detach(index,step,{});
    }
    this.detach(index,{from:s.glyph,to:null,removed:s.glyph,x:.5,y:.5,w:1,h:1,terminal:true},{});
  }
  detach(index, step, info) {
    const e=this.run.enemies,entry=this.entry(e.species[index]);
    const s=this.state(index,e.species[index],e.gen[index]);
    const removed = this.art(step.removed, entry.color), target = step.terminal || this.art(step.to, entry.color);
    if (!removed || !target) return;
    const art = this.art(s.glyph, entry.color), sprite = this.run.sprites.get(e.species[index]);
    const size = Math.max(.75, sprite.bodyHeight(e.scale[index]));
    const last = s.last && this.run.time - s.seenAt < .15 ? s.last : {x:e.x[index], y:e.y[index] + size / 2, z:e.z[index], size,
      width:size * art.width / entry.art.height, height:size * art.height / entry.art.height, pose:{sx:1,sy:1,angle:0,bend:0}};
    const right = this.run.sprites.camRight;
    let dx = info.dirX ?? e.x[index] - this.run.player.pos.x, dz = info.dirZ ?? e.z[index] - this.run.player.pos.z;
    const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
    const px = (step.x - .5) * last.width * last.pose.sx, py = (.5 - step.y) * last.height * last.pose.sy;
    const c = Math.cos(last.pose.angle), sin = Math.sin(last.pose.angle);
    const ox = px * c - py * sin, oy = px * sin + py * c;
    if (this.debris.length >= DEBRIS_LIMIT) this.debris.shift();
    this.debris.push({art:removed, glyph:step.removed, from:step.from, to:step.to,
      width:last.width * step.w, height:last.height * step.h,
      x:last.x + right.x * ox, y:last.y + oy, z:last.z + right.z * ox,
      vx:dx * 2.6 + right.x * 1.1, vz:dz * 2.6 + right.z * 1.1,
      vy:3.6, angle:last.pose.angle, spin:4.5, life:2.3, bounces:0});
    if(step.terminal)s.finished=true;
    else {s.glyph = step.to; s.step++; s.changedAt = this.run.time;}
    // A second release in the same frame must use the new glyph dimensions.
    s.last=null;
    this.stats.breaks++;
    if (!step.terminal && this.run.time - this.lastPopup > .7) {
      this.lastPopup = this.run.time;
      this.run.ui.popup(e.x[index], e.y[index] + e.hgt[index] + .5, e.z[index], `${step.from} → ${step.to}`, entry.color, .9);
    }
    this.stats.peakDebris = Math.max(this.stats.peakDebris, this.debris.length);
  }
  end() {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i], dt = this.dt;
      d.life -= dt;
      if (d.life <= 0) { this.debris.splice(i, 1); continue; }
      d.vy -= 13 * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt; d.angle += d.spin * dt;
      const ground = this.run.terrain.surface(d.x, d.z) + .08 + d.height * .22;
      if (d.y < ground) {
        d.y = ground;
        if (d.vy < -.8 && d.bounces < 2) { d.vy *= -.38; d.bounces++; d.spin *= .55; }
        else { d.vy = 0; d.spin *= Math.exp(-12 * dt); }
        d.vx *= Math.exp(-7 * dt); d.vz *= Math.exp(-7 * dt);
      }
      this.add(d.art, d.x, d.y, d.z, d.width, d.height, {sx:1,sy:1,angle:d.angle}, 1 - clamp(d.life / .5));
    }
    this.mesh.count = this.count; this.mesh.visible = this.count > 0; this.stats.drawn = this.count;
    for (const a of Object.values(this.attributes)) { a.clearUpdateRanges(); a.addUpdateRange(0, this.count * a.itemSize); a.needsUpdate = true; }
  }
  clear() { this.states.clear(); this.debris.length = 0; this.mesh.count = 0; this.lastTime = this.run.time || 0; }
  dispose() { this.disposed = true; this.clear(); this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.material.dispose(); this.texture.dispose(); }
}
