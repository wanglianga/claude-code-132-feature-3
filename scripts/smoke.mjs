// 冒烟测试：esbuild 打 IIFE 包 → jsdom 执行 → 模拟各角色登录并遍历页面
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'

const bundle = readFileSync(new URL('../smoke-dist/app.iife.js', import.meta.url), 'utf8')

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost:5173/#/login',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
})
const { window } = dom
const { document } = window

window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }))
window.scrollTo = window.scrollTo || (() => {})
window.alert = window.alert || (() => {})
window.confirm = () => true
window.prompt = () => ''
window.onerror = (msg) => { throw new Error(`window.onerror: ${msg}`) }

window.eval(bundle)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const fail = (name, why) => { results.push(`❌ ${name}: ${why}`); }
const pass = (name) => results.push(`✅ ${name}`)

function bodyText() {
  return document.body.textContent || ''
}
async function clickLogin(username) {
  const inputs = document.querySelectorAll('.login-card input.input')
  const [u, p] = inputs
  u.value = username
  u.dispatchEvent(new window.Event('input', { bubbles: true }))
  p.value = '123456'
  p.dispatchEvent(new window.Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('.login-card button')].find((b) => b.textContent.includes('登 录'))
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
}
async function logout() {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('退出登录'))
  if (btn) {
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await sleep(120)
  }
}
async function goto(hash) {
  window.location.hash = hash
  await sleep(150)
}

await sleep(300)

// 1. 登录页渲染
if (bodyText().includes('亲子旧物交换平台') && bodyText().includes('测试账号')) pass('登录页渲染')
else fail('登录页渲染', '未找到预期文案')

// 2. 家长端
await clickLogin('parent1')
if (bodyText().includes('我的物品') && bodyText().includes('遥控赛车')) pass('家长登录+我的物品')
else fail('家长登录+我的物品', bodyText().slice(0, 120))

await goto('#/parent/submit')
if (bodyText().includes('报名新物品') && bodyText().includes('期望换取类型')) pass('家长-报名表单')
else fail('家长-报名表单', bodyText().slice(0, 120))

await goto('#/parent/matches')
if (bodyText().includes('撮合中心') && bodyText().includes('智能推荐')) pass('家长-撮合中心')
else fail('家长-撮合中心', bodyText().slice(0, 120))

await goto('#/parent/incidents')
if (bodyText().includes('争议协调')) pass('家长-争议协调')
else fail('家长-争议协调', bodyText().slice(0, 120))

// 3. 家长确认撮合（李敏的磁力片 m1 处于 proposed）——用 parent2 登录接受
await logout()
await clickLogin('parent2')
await goto('#/parent/matches')
const acceptBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('接受撮合'))
if (acceptBtn) {
  acceptBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('已接受，等待对方确认')) pass('家长-接受撮合')
  else fail('家长-接受撮合', '状态未变为等待对方确认')
} else fail('家长-接受撮合', '未找到接受按钮')
await logout()

// 4. 社区工作人员端
await clickLogin('staff')
if (bodyText().includes('物品审核') && bodyText().includes('待审核')) pass('社区-审核队列')
else fail('社区-审核队列', bodyText().slice(0, 120))

// 审核驳回药品（精确定位「儿童感冒药」所在卡片）
const medRow = [...document.querySelectorAll('.review-row')].find((r) => r.textContent.includes('儿童感冒药'))
const medRejectBtn = medRow && [...medRow.querySelectorAll('button')].find((b) => b.textContent.includes('驳回'))
if (medRejectBtn) {
  medRejectBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  const chips = [...document.querySelectorAll('.modal .chip')]
  const med = chips.find((c) => c.textContent.includes('药品'))
  if (med) med.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(80)
  const confirmBtn = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('确认驳回'))
  confirmBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('药品类物品不参与交换')) pass('社区-驳回药品')
  else fail('社区-驳回药品', '未找到驳回原因文案')
} else fail('社区-驳回药品', '未找到药品物品或其驳回按钮')

await goto('#/staff/match')
if (bodyText().includes('撮合管理') && bodyText().includes('一键智能撮合')) pass('社区-撮合管理')
else fail('社区-撮合管理', bodyText().slice(0, 120))

// 执行智能撮合
const autoBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('一键智能撮合'))
autoBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await sleep(150)
if (bodyText().includes('已生成') || bodyText().includes('没有满足条件')) pass('社区-智能撮合执行')
else fail('社区-智能撮合执行', bodyText().slice(0, 200))

await goto('#/staff/onsite')
if (bodyText().includes('现场总览') && bodyText().includes('自由交换区现场登记')) pass('社区-现场总览')
else fail('社区-现场总览', bodyText().slice(0, 120))

await goto('#/staff/incidents')
if (bodyText().includes('异常处置台') && bodyText().includes('价值争议')) pass('社区-异常处置台')
else fail('社区-异常处置台', bodyText().slice(0, 120))

await goto('#/staff/summary')
if (bodyText().includes('活动总结') && bodyText().includes('品类缺口') && bodyText().includes('未到场名单')) pass('社区-活动总结')
else fail('社区-活动总结', bodyText().slice(0, 120))
await logout()

// 5. 志愿者端：扫码核销
await clickLogin('volunteer')
if (bodyText().includes('扫码核销台')) pass('志愿者-核销台渲染')
else fail('志愿者-核销台渲染', bodyText().slice(0, 120))
const codeInput = document.querySelector('input.input')
codeInput.value = 'SW-1011'
codeInput.dispatchEvent(new window.Event('input', { bubbles: true }))
const verifyBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '核销')
verifyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await sleep(150)
if (bodyText().includes('儿童平衡车') && bodyText().includes('实物与报名照片一致')) pass('志愿者-扫码找到物品')
else fail('志愿者-扫码找到物品', bodyText().slice(0, 200))
const submitBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('核验通过，完成核销'))
if (submitBtn) {
  submitBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('SW-1011') === false || bodyText().includes('已核销')) pass('志愿者-完成核销')
  else fail('志愿者-完成核销', bodyText().slice(0, 200))
} else fail('志愿者-完成核销', '未找到提交按钮')
await logout()

// 6. 公益机构端
await clickLogin('charity')
if (bodyText().includes('捐赠接收') && bodyText().includes('木质拼图')) pass('公益-捐赠接收')
else fail('公益-捐赠接收', bodyText().slice(0, 120))

// 承接设置已标记（年龄段 / 上限 / 运输 / 开票）
if (bodyText().includes('本场承接设置') && bodyText().includes('可接收年龄段') && bodyText().includes('承接上限')) {
  pass('公益-承接设置展示')
} else fail('公益-承接设置展示', '未找到承接信息文案')

// 年龄段不符的申请（早教识字卡片 0–2 岁，机构接收 3–9 岁）接收按钮应被禁用
const unfitRow = [...document.querySelectorAll('.donation-row')].find((r) => r.textContent.includes('早教识字卡片'))
const unfitAcceptBtn = unfitRow && [...unfitRow.querySelectorAll('button')].find((b) => b.textContent.includes('确认接收'))
if (unfitAcceptBtn && unfitAcceptBtn.disabled) pass('公益-超范围物品禁止接收')
else fail('公益-超范围物品禁止接收', '未找到被禁用的接收按钮')

// 接收木质拼图：打开清点弹窗 → 确认 → 生成交接清单
const puzzleRow = [...document.querySelectorAll('.donation-row')].find((r) => r.textContent.includes('木质拼图'))
const puzzleAcceptBtn = puzzleRow && [...puzzleRow.querySelectorAll('button')].find((b) => b.textContent.includes('确认接收'))
if (puzzleAcceptBtn) {
  puzzleAcceptBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  if (!bodyText().includes('现场清点接收')) fail('公益-接收弹窗', '未打开现场清点弹窗')
  const confirmRecvBtn = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('生成交接清单'))
  if (!confirmRecvBtn) fail('公益-接收弹窗', '未找到确认接收按钮')
  else {
    confirmRecvBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await sleep(180)
    if (bodyText().includes('公益捐赠交接清单') && bodyText().includes('运输时间') && bodyText().includes('HO-')) {
      pass('公益-确认接收并生成交接清单')
    } else fail('公益-确认接收并生成交接清单', bodyText().slice(0, 200))
    // 关闭交接清单
    const closeHo = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === '关闭')
    if (closeHo) closeHo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await sleep(80)
  }
} else fail('公益-确认接收并生成交接清单', '未找到木质拼图接收按钮')

// 年龄段不符物品拒收
if (unfitRow) {
  const unfitDecline = [...unfitRow.querySelectorAll('button')].find((b) => b.textContent.includes('拒收'))
  unfitDecline.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(100)
  const ageChip = [...document.querySelectorAll('.modal .chip')].find((c) => c.textContent.includes('不在可接收年龄段'))
  ageChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(60)
  const confirmDecl = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === '确认拒收')
  confirmDecl.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('不在可接收年龄段') && bodyText().includes('早教识字卡片')) pass('公益-年龄段不符拒收')
  else fail('公益-年龄段不符拒收', bodyText().slice(0, 200))
} else fail('公益-年龄段不符拒收', '未找到年龄段不符的申请行')
await logout()

// 7. 社区：先确认破损拒收异常单已生成（默认「待处理」标签）
await clickLogin('staff')
await goto('#/staff/incidents')
if (bodyText().includes('公益机构破损拒收') && bodyText().includes('小熊绘本')) pass('社区-破损拒收异常单')
else fail('社区-破损拒收异常单', bodyText().slice(0, 200))
await logout()

// 8. 家长处理破损拒收（小熊绘本 → 环保回收，登记现场处理人）
await clickLogin('parent2')
await goto('#/parent/items')
if (bodyText().includes('小熊绘本') && bodyText().includes('破损不符合捐赠标准')) pass('家长-破损拒收退回提示')
else fail('家长-破损拒收退回提示', bodyText().slice(0, 200))
const recycleBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('同意环保回收'))
if (recycleBtn) {
  recycleBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(100)
  const confirmDisp = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === '确认')
  confirmDisp.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('现场处理人：李敏') && bodyText().includes('环保回收')) pass('家长-破损物品环保回收登记')
  else fail('家长-破损物品环保回收登记', bodyText().slice(0, 200))
} else fail('家长-破损物品环保回收登记', '未找到同意环保回收按钮')
await logout()

// 9. 社区：活动总结中的去向分布与交接清单
await clickLogin('staff')
await goto('#/staff/summary')
if (bodyText().includes('环保回收') && bodyText().includes('捐赠交接清单') && bodyText().includes('寄存社区')) {
  pass('社区-总结去向与交接清单')
} else fail('社区-总结去向与交接清单', bodyText().slice(0, 200))
await logout()

console.log(results.join('\n'))
const failed = results.filter((r) => r.startsWith('❌'))
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
process.exit(failed.length ? 1 : 0)
