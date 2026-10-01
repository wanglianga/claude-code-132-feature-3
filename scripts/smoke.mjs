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

// 6. 公益机构端：承接配置 + 按上限接收 + 交接清单
await clickLogin('charity')
if (bodyText().includes('捐赠接收') && bodyText().includes('木质拼图')) pass('公益-捐赠接收')
else fail('公益-捐赠接收', bodyText().slice(0, 120))
if (bodyText().includes('本场承接配置') && bodyText().includes('运输') && bodyText().includes('捐赠票据')) {
  pass('公益-承接年龄段/数量/运输/开票配置展示')
} else fail('公益-承接配置展示', bodyText().slice(0, 200))
// 9–12 岁的少儿科普图鉴应被拦截在可接收范围外（配额 0）
if (bodyText().includes('不在公益机构本场可接收年龄段内')) pass('公益-年龄段上限拦截提示')
else fail('公益-年龄段上限拦截提示', bodyText().slice(0, 300))

// 打开第一件可接收物品（木质拼图）的接收弹窗
const openAcceptBtn = [...document.querySelectorAll('button')]
  .find((b) => b.textContent.includes('确认接收并生成交接清单') && !b.disabled)
if (openAcceptBtn) {
  openAcceptBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  if (bodyText().includes('填写交接清单') && bodyText().includes('现场经办人')) pass('公益-接收弹窗/交接清单表单')
  else fail('公益-接收弹窗/交接清单表单', bodyText().slice(0, 200))
  const confirmAcceptBtn = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('确认接收，生成交接清单'))
  confirmAcceptBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('交接清单') && bodyText().includes('上门清运') && bodyText().includes('经办人')) {
    pass('公益-接收并生成交接清单与照片')
  } else fail('公益-接收并生成交接清单与照片', bodyText().slice(0, 300))
} else fail('公益-接收弹窗', '未找到可用的接收按钮')

// 对超范围的少儿科普图鉴执行「超过承接上限，拒收」并记录现场处理人
const capDeclineBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('超过承接上限，拒收'))
if (capDeclineBtn) {
  capDeclineBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  if (bodyText().includes('带回、寄存到社区或预约下一场')) pass('公益-超限拒收去向提示')
  else fail('公益-超限拒收去向提示', bodyText().slice(0, 200))
  const modalInputs = [...document.querySelectorAll('.modal input.input')]
  const handlerInput = modalInputs[modalInputs.length - 1]
  handlerInput.value = '赵伟'
  handlerInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  const confirmDeclineBtn = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('确认拒收并通知家长'))
  confirmDeclineBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('已拒收记录') && bodyText().includes('赵伟')) pass('公益-超限拒收并记录现场处理人')
  else fail('公益-超限拒收并记录现场处理人', bodyText().slice(0, 300))
} else fail('公益-超限拒收', '未找到拒收按钮')
await logout()

// 7. 家长端：超过承接上限物品确认去向（寄存社区）
await clickLogin('parent4')
if (bodyText().includes('经典童话绘本') && bodyText().includes('超过公益机构本场承接上限')) {
  pass('家长-超限物品提示带回/寄存/约下场')
} else fail('家长-超限物品提示', bodyText().slice(0, 300))
const disposeBtn4 = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('确认物品去向'))
if (disposeBtn4) {
  disposeBtn4.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  const storeOpt = [...document.querySelectorAll('.dispose-opt')].find((b) => b.textContent.includes('寄存到社区'))
  storeOpt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(60)
  const confirmDisposeBtn = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === '确认去向')
  confirmDisposeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('已寄存社区')) pass('家长-超限物品确认寄存社区')
  else fail('家长-超限物品确认寄存社区', bodyText().slice(0, 300))
} else fail('家长-超限物品确认', '未找到确认去向按钮')
await logout()

// 8. 家长端：破损拒收物品 → 环保回收；已捐赠物品 → 查看交接清单
await clickLogin('parent1')
if (bodyText().includes('布偶拼图') && bodyText().includes('因物品破损拒收')) {
  pass('家长-破损拒收回到家长确认流程')
} else fail('家长-破损拒收提示', bodyText().slice(0, 300))
const disposeBtn1 = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('确认物品去向'))
if (disposeBtn1) {
  disposeBtn1.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  if (bodyText().includes('环保回收') && !bodyText().includes('寄存到社区')) pass('家长-破损物品仅可带回/环保回收')
  else fail('家长-破损物品处置选项', bodyText().slice(0, 300))
  const recycleOpt = [...document.querySelectorAll('.dispose-opt')].find((b) => b.textContent.includes('环保回收'))
  recycleOpt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(60)
  const confirmDisposeBtn = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === '确认去向')
  confirmDisposeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(150)
  if (bodyText().includes('已环保回收') && bodyText().includes('绿芽再生资源回收点')) pass('家长-破损物品环保回收并记录处理人')
  else fail('家长-破损物品环保回收', bodyText().slice(0, 300))
} else fail('家长-破损物品处置', '未找到确认去向按钮')
await logout()

// 已捐赠的婴儿连体衣（parent3 张磊）应可查看交接清单与去向
await clickLogin('parent3')
const hvBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('查看交接清单与去向'))
if (hvBtn) {
  hvBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  if (bodyText().includes('捐赠交接清单') && bodyText().includes('山区幼儿园') && bodyText().includes('春芽公益')) {
    pass('家长-查看捐赠交接清单与去向')
  } else fail('家长-查看捐赠交接清单', bodyText().slice(0, 300))
} else fail('家长-查看捐赠交接清单', '未找到交接清单入口')
await logout()

// 9. 工作人员端：拒收异常办结后在「已解决」页签可查；总结页含新去向与交接清单
await clickLogin('staff')
await goto('#/staff/incidents')
const resolvedChip = [...document.querySelectorAll('.chip')].find((c) => c.textContent.includes('已解决'))
resolvedChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await sleep(120)
if (bodyText().includes('破损被公益机构拒收') && bodyText().includes('环保回收')) {
  pass('社区-破损拒收异常处置留痕')
} else fail('社区-破损拒收异常处置留痕', bodyText().slice(0, 300))
await goto('#/staff/summary')
if (
  bodyText().includes('寄存社区') &&
  bodyText().includes('环保回收') &&
  bodyText().includes('捐赠去向与交接清单')
) {
  pass('社区-总结页去向分布与交接清单')
} else fail('社区-总结页去向分布与交接清单', bodyText().slice(0, 300))

console.log(results.join('\n'))
const failed = results.filter((r) => r.startsWith('❌'))
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
process.exit(failed.length ? 1 : 0)
