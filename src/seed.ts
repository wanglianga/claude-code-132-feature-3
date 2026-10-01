import type { DB, DisposalRecord, HistoryEntry, Item, ItemStatus, User } from './types'

const H = 3600_000
const now = Date.now()

function h(at: number, actor: string, action: string, detail?: string): HistoryEntry {
  return { at, actor, action, detail }
}

const users: User[] = [
  { id: 'u_p1', username: 'parent1', password: '123456', name: '王晓', role: 'parent', phone: '13800000001', childName: '天天', childAge: 5 },
  { id: 'u_p2', username: 'parent2', password: '123456', name: '李敏', role: 'parent', phone: '13800000002', childName: '豆豆', childAge: 7 },
  { id: 'u_p3', username: 'parent3', password: '123456', name: '张磊', role: 'parent', phone: '13800000003', childName: '果果', childAge: 3 },
  { id: 'u_p4', username: 'parent4', password: '123456', name: '陈静', role: 'parent', phone: '13800000004', childName: '乐乐', childAge: 9 },
  { id: 'u_staff', username: 'staff', password: '123456', name: '王芳', role: 'staff', phone: '13900000001' },
  { id: 'u_vol', username: 'volunteer', password: '123456', name: '赵伟', role: 'volunteer', phone: '13900000002' },
  { id: 'u_charity', username: 'charity', password: '123456', name: '刘洋', role: 'charity', orgName: '春芽公益', phone: '13700000001' },
]

interface ItemSeed {
  id: string
  code: string
  parentId: string
  name: string
  category: Item['category']
  condition: Item['condition']
  emoji: string
  disinfected: boolean
  desired: Item['desiredCategories']
  value: [number, number]
  age: [number, number]
  slots: string[]
  donation: boolean
  status: ItemStatus
  note?: string
  booth?: string
  entryTime?: string
  review?: Item['review']
  checkIn?: Item['checkIn']
  disposal?: DisposalRecord
  history: HistoryEntry[]
}

const S1 = '09:00-10:30'
const S2 = '10:30-12:00'
const S3 = '13:30-15:00'
const S4 = '15:00-16:30'

function mk(s: ItemSeed): Item {
  return {
    id: s.id,
    code: s.code,
    parentId: s.parentId,
    name: s.name,
    category: s.category,
    condition: s.condition,
    photos: [s.emoji],
    disinfected: s.disinfected,
    desiredCategories: s.desired,
    valueRange: s.value,
    ageRange: s.age,
    timeSlots: s.slots,
    acceptDonation: s.donation,
    note: s.note,
    status: s.status,
    review: s.review,
    booth: s.booth,
    entryTime: s.entryTime,
    checkIn: s.checkIn,
    disposal: s.disposal,
    history: s.history,
    createdAt: s.history[0]?.at ?? now,
  }
}

const submitted = (parent: string, at: number) => h(at, parent, '提交报名', '填写物品信息并提交审核')
const approvedH = (at: number) => h(at, '王芳', '审核通过', '物品符合现场交换要求')
const checkedIn = (at: number, by = '赵伟') => h(at, by, '扫码核销', '物品到场，核验通过')

const items: Item[] = [
  // ---------- 待审核 ----------
  mk({
    id: 'itm_001', code: 'SW-1001', parentId: 'u_p1', name: '遥控赛车', category: 'toy', condition: 'good',
    emoji: '🏎️', disinfected: true, desired: ['book', 'study'], value: [51, 100], age: [3, 9],
    slots: [S1, S2], donation: true, status: 'pending',
    note: '遥控器灵敏，车身有轻微划痕',
    history: [submitted('王晓', now - 5 * H)],
  }),
  mk({
    id: 'itm_002', code: 'SW-1002', parentId: 'u_p2', name: '恐龙绘本套装（6 本）', category: 'book', condition: 'like_new',
    emoji: '🦕', disinfected: true, desired: ['toy'], value: [21, 50], age: [3, 6],
    slots: [S1, S3], donation: true, status: 'pending',
    history: [submitted('李敏', now - 4 * H)],
  }),
  mk({
    id: 'itm_003', code: 'SW-1003', parentId: 'u_p3', name: '儿童感冒药（未开封）', category: 'medicine', condition: 'new',
    emoji: '💊', disinfected: false, desired: ['toy'], value: [0, 20], age: [0, 12],
    slots: [S1], donation: false, status: 'pending',
    note: '家里囤多了，想换点玩具',
    history: [submitted('张磊', now - 3 * H)],
  }),
  mk({
    id: 'itm_004', code: 'SW-1004', parentId: 'u_p4', name: '手持烟花棒', category: 'dangerous', condition: 'new',
    emoji: '🎆', disinfected: false, desired: ['toy'], value: [21, 50], age: [6, 12],
    slots: [S2], donation: false, status: 'pending',
    history: [submitted('陈静', now - 2 * H)],
  }),
  // ---------- 审核通过，待撮合 ----------
  mk({
    id: 'itm_005', code: 'SW-1005', parentId: 'u_p1', name: '乐高经典积木盒', category: 'toy', condition: 'good',
    emoji: '🧱', disinfected: true, desired: ['book', 'study'], value: [51, 100], age: [3, 9],
    slots: [S1, S2], donation: true, status: 'approved',
    review: { by: '王芳', at: now - 26 * H, result: 'approved' },
    history: [submitted('王晓', now - 30 * H), approvedH(now - 26 * H)],
  }),
  mk({
    id: 'itm_006', code: 'SW-1006', parentId: 'u_p2', name: '儿童绘本 20 本', category: 'book', condition: 'good',
    emoji: '📖', disinfected: true, desired: ['toy'], value: [51, 100], age: [3, 6],
    slots: [S1, S2], donation: true, status: 'approved',
    review: { by: '王芳', at: now - 26 * H, result: 'approved' },
    history: [submitted('李敏', now - 29 * H), approvedH(now - 26 * H)],
  }),
  mk({
    id: 'itm_007', code: 'SW-1007', parentId: 'u_p3', name: '女童连衣裙（120 码）', category: 'clothing', condition: 'like_new',
    emoji: '👗', disinfected: true, desired: ['book'], value: [21, 50], age: [3, 6],
    slots: [S2, S4], donation: true, status: 'approved',
    review: { by: '王芳', at: now - 25 * H, result: 'approved' },
    history: [submitted('张磊', now - 28 * H), approvedH(now - 25 * H)],
  }),
  mk({
    id: 'itm_008', code: 'SW-1008', parentId: 'u_p4', name: '科学实验套装', category: 'study', condition: 'like_new',
    emoji: '🔬', disinfected: true, desired: ['toy'], value: [51, 100], age: [6, 12],
    slots: [S1, S3], donation: false, status: 'approved',
    review: { by: '王芳', at: now - 25 * H, result: 'approved' },
    history: [submitted('陈静', now - 27 * H), approvedH(now - 25 * H)],
  }),
  // ---------- 已撮合，待确认 ----------
  mk({
    id: 'itm_009', code: 'SW-1009', parentId: 'u_p2', name: '磁力片 64 片', category: 'toy', condition: 'like_new',
    emoji: '🧲', disinfected: true, desired: ['book', 'study'], value: [51, 100], age: [3, 9],
    slots: [S1, S2], donation: true, status: 'matched',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    history: [submitted('李敏', now - 28 * H), approvedH(now - 24 * H), h(now - 20 * H, '系统', '智能撮合', '与「少儿百科全书」配对，待双方确认')],
  }),
  mk({
    id: 'itm_010', code: 'SW-1010', parentId: 'u_p4', name: '少儿百科全书', category: 'book', condition: 'good',
    emoji: '📚', disinfected: true, desired: ['toy', 'study'], value: [51, 100], age: [6, 12],
    slots: [S1, S2], donation: true, status: 'matched',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    history: [submitted('陈静', now - 27 * H), approvedH(now - 24 * H), h(now - 20 * H, '系统', '智能撮合', '与「磁力片 64 片」配对，待双方确认')],
  }),
  // ---------- 已预约 ----------
  mk({
    id: 'itm_011', code: 'SW-1011', parentId: 'u_p1', name: '儿童平衡车', category: 'toy', condition: 'good',
    emoji: '🛴', disinfected: true, desired: ['study'], value: [101, 9999], age: [3, 6],
    slots: [S1], donation: false, status: 'reserved', booth: 'B-01', entryTime: S1,
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    history: [submitted('王晓', now - 30 * H), approvedH(now - 24 * H), h(now - 19 * H, '系统', '智能撮合', '与「点读笔套装」配对'), h(now - 10 * H, '系统', '预约成功', '摊位 B-01，入场时段 09:00-10:30')],
  }),
  mk({
    id: 'itm_012', code: 'SW-1012', parentId: 'u_p3', name: '点读笔套装', category: 'study', condition: 'like_new',
    emoji: '🖊️', disinfected: true, desired: ['toy'], value: [101, 9999], age: [3, 6],
    slots: [S1], donation: false, status: 'reserved', booth: 'B-01', entryTime: S1,
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    history: [submitted('张磊', now - 29 * H), approvedH(now - 24 * H), h(now - 19 * H, '系统', '智能撮合', '与「儿童平衡车」配对'), h(now - 10 * H, '系统', '预约成功', '摊位 B-01，入场时段 09:00-10:30')],
  }),
  // ---------- 已核销（存在进行中的价值争议） ----------
  mk({
    id: 'itm_013', code: 'SW-1013', parentId: 'u_p4', name: '积木桌', category: 'toy', condition: 'good',
    emoji: '🪑', disinfected: true, desired: ['book'], value: [51, 100], age: [3, 6],
    slots: [S1, S2], donation: true, status: 'verified', booth: 'B-02', entryTime: S1,
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 2 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    history: [submitted('陈静', now - 28 * H), approvedH(now - 24 * H), h(now - 18 * H, '系统', '预约成功', '摊位 B-02'), checkedIn(now - 2 * H), h(now - 1 * H, '赵伟', '上报异常', '双方对价值存在争议')],
  }),
  mk({
    id: 'itm_014', code: 'SW-1014', parentId: 'u_p2', name: '英语分级读物 30 本', category: 'book', condition: 'good',
    emoji: '🔤', disinfected: true, desired: ['toy'], value: [51, 100], age: [3, 9],
    slots: [S1, S2], donation: true, status: 'verified', booth: 'B-02', entryTime: S1,
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 2 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    history: [submitted('李敏', now - 28 * H), approvedH(now - 24 * H), h(now - 18 * H, '系统', '预约成功', '摊位 B-02'), checkedIn(now - 2 * H)],
  }),
  // ---------- 交换成功 ----------
  mk({
    id: 'itm_015', code: 'SW-1015', parentId: 'u_p1', name: '儿童滑板车', category: 'toy', condition: 'good',
    emoji: '🛴', disinfected: true, desired: ['study'], value: [51, 100], age: [3, 9],
    slots: [S1], donation: false, status: 'exchanged', booth: 'B-03', entryTime: S1,
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 3 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    history: [submitted('王晓', now - 29 * H), approvedH(now - 24 * H), h(now - 18 * H, '系统', '预约成功', '摊位 B-03'), checkedIn(now - 3 * H), h(now - 2 * H, '赵伟', '交换成功', '与「儿童显微镜」完成交换')],
  }),
  mk({
    id: 'itm_016', code: 'SW-1016', parentId: 'u_p3', name: '儿童显微镜', category: 'study', condition: 'like_new',
    emoji: '🔬', disinfected: true, desired: ['toy'], value: [51, 100], age: [6, 12],
    slots: [S1], donation: false, status: 'exchanged', booth: 'B-03', entryTime: S1,
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 3 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    history: [submitted('张磊', now - 29 * H), approvedH(now - 24 * H), h(now - 18 * H, '系统', '预约成功', '摊位 B-03'), checkedIn(now - 3 * H), h(now - 2 * H, '赵伟', '交换成功', '与「儿童滑板车」完成交换')],
  }),
  // ---------- 自由交换区 ----------
  mk({
    id: 'itm_017', code: 'SW-1017', parentId: 'u_p2', name: '毛绒玩具熊', category: 'toy', condition: 'fair',
    emoji: '🧸', disinfected: true, desired: ['book'], value: [0, 20], age: [0, 6],
    slots: [S2, S3], donation: true, status: 'free_zone',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    history: [submitted('李敏', now - 27 * H), approvedH(now - 24 * H), h(now - 12 * H, '王芳', '转入自由交换区', '本轮未匹配成功')],
  }),
  mk({
    id: 'itm_018', code: 'SW-1018', parentId: 'u_p3', name: '婴儿背带', category: 'baby', condition: 'good',
    emoji: '🎒', disinfected: true, desired: ['clothing'], value: [21, 50], age: [0, 3],
    slots: [S1, S4], donation: true, status: 'free_zone',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    history: [submitted('张磊', now - 26 * H), approvedH(now - 24 * H), h(now - 12 * H, '王芳', '转入自由交换区', '本轮未匹配成功')],
  }),
  // ---------- 无人交换（申请转捐中，年龄段符合） ----------
  mk({
    id: 'itm_019', code: 'SW-1019', parentId: 'u_p4', name: '木质拼图 500 片', category: 'toy', condition: 'good',
    emoji: '🧩', disinfected: true, desired: ['study'], value: [21, 50], age: [6, 12],
    slots: [S2], donation: true, status: 'no_exchange',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 4 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    history: [submitted('陈静', now - 26 * H), approvedH(now - 24 * H), checkedIn(now - 4 * H), h(now - 1 * H, '系统', '无人交换', '自由交换区未换出，可申请转捐'), h(now - 0.5 * H, '陈静', '申请公益转捐', '等待「春芽公益」接收')],
  }),
  // ---------- 已转捐（含交接清单） ----------
  mk({
    id: 'itm_020', code: 'SW-1020', parentId: 'u_p3', name: '婴儿连体衣 5 件', category: 'clothing', condition: 'good',
    emoji: '👶', disinfected: true, desired: ['baby'], value: [21, 50], age: [0, 3],
    slots: [S1], donation: true, status: 'donated',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 5 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, note: '实物颜色略浅，已现场补拍确认', passed: true },
    history: [submitted('张磊', now - 27 * H), approvedH(now - 24 * H), checkedIn(now - 5 * H), h(now - 2 * H, '系统', '无人交换'), h(now - 1.2 * H, '张磊', '申请公益转捐'), h(now - 1 * H, '刘洋', '公益接收', '春芽公益接收并生成交接清单 HO-2609-01')],
  }),
  // ---------- 已带回 ----------
  mk({
    id: 'itm_021', code: 'SW-1021', parentId: 'u_p2', name: '儿童书包', category: 'study', condition: 'good',
    emoji: '🎒', disinfected: true, desired: ['toy'], value: [21, 50], age: [6, 9],
    slots: [S3], donation: false, status: 'taken_back',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 4 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    disposal: { type: 'take_back', handler: '李敏', handlerRole: 'parent', at: now - 1 * H },
    history: [submitted('李敏', now - 26 * H), approvedH(now - 24 * H), checkedIn(now - 4 * H), h(now - 1 * H, '李敏', '自行带回', '未换到心仪物品，选择带回')],
  }),
  // ---------- 未到场 ----------
  mk({
    id: 'itm_022', code: 'SW-1022', parentId: 'u_p4', name: '变形金刚玩具', category: 'toy', condition: 'like_new',
    emoji: '🤖', disinfected: true, desired: ['study'], value: [51, 100], age: [6, 12],
    slots: [S2], donation: false, status: 'no_show', booth: 'B-04', entryTime: S2,
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    history: [submitted('陈静', now - 27 * H), approvedH(now - 24 * H), h(now - 16 * H, '系统', '预约成功', '摊位 B-04'), h(now - 1 * H, '赵伟', '标记未到场', '超过入场时段未到，联系方式无人接听')],
  }),
  // ---------- 已驳回 ----------
  mk({
    id: 'itm_023', code: 'SW-1023', parentId: 'u_p1', name: '维生素软糖', category: 'food', condition: 'new',
    emoji: '🍬', disinfected: false, desired: ['toy'], value: [0, 20], age: [3, 12],
    slots: [S1], donation: false, status: 'rejected',
    review: { by: '王芳', at: now - 25 * H, result: 'rejected', reason: '食品类物品不参与交换' },
    history: [submitted('王晓', now - 28 * H), h(now - 25 * H, '王芳', '审核驳回', '食品类物品不参与交换')],
  }),
  // ---------- 公益机构破损拒收，待家长确认去向 ----------
  mk({
    id: 'itm_024', code: 'SW-1024', parentId: 'u_p2', name: '小熊绘本 10 本', category: 'book', condition: 'fair',
    emoji: '🐻', disinfected: true, desired: ['toy'], value: [0, 20], age: [3, 6],
    slots: [S2], donation: true, status: 'parent_confirm',
    note: '孩子小时候反复翻阅，书角有磨损',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 3 * H, by: '赵伟', photoMatch: true, damage: 'minor', disinfectedConfirmed: true, note: '书角有水渍和卷边，家长已知情，可继续参与交换', passed: true },
    history: [submitted('李敏', now - 26 * H), approvedH(now - 24 * H), checkedIn(now - 3 * H), h(now - 1.5 * H, '系统', '无人交换', '自由交换区未换出，可申请转捐'), h(now - 1 * H, '李敏', '申请公益转捐'), h(now - 0.5 * H, '刘洋', '公益拒收', '书角卷边且有明显水渍，不符合捐赠标准，退回家长确认去向')],
  }),
  // ---------- 无人交换（申请转捐中，年龄段符合） ----------
  mk({
    id: 'itm_025', code: 'SW-1025', parentId: 'u_p1', name: '经典童话绘本 8 本', category: 'book', condition: 'good',
    emoji: '📕', disinfected: true, desired: ['toy'], value: [21, 50], age: [3, 6],
    slots: [S2, S3], donation: true, status: 'no_exchange',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 3 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    history: [submitted('王晓', now - 26 * H), approvedH(now - 24 * H), checkedIn(now - 3 * H), h(now - 1 * H, '系统', '无人交换'), h(now - 0.5 * H, '王晓', '申请公益转捐')],
  }),
  // ---------- 无人交换（年龄段 0–2 岁，不在公益机构接收范围 3–9 岁） ----------
  mk({
    id: 'itm_026', code: 'SW-1026', parentId: 'u_p3', name: '早教识字卡片', category: 'study', condition: 'like_new',
    emoji: '🔠', disinfected: true, desired: ['toy'], value: [0, 20], age: [0, 2],
    slots: [S1], donation: true, status: 'no_exchange',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 3 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    history: [submitted('张磊', now - 26 * H), approvedH(now - 24 * H), checkedIn(now - 3 * H), h(now - 1 * H, '系统', '无人交换'), h(now - 0.5 * H, '张磊', '申请公益转捐')],
  }),
  // ---------- 超承接上限，寄存社区 ----------
  mk({
    id: 'itm_027', code: 'SW-1027', parentId: 'u_p4', name: '涂色本一摞（约 15 本）', category: 'book', condition: 'good',
    emoji: '🎨', disinfected: true, desired: ['toy'], value: [0, 20], age: [3, 6],
    slots: [S3], donation: true, status: 'stored_community',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 3 * H, by: '赵伟', photoMatch: true, damage: 'none', disinfectedConfirmed: true, passed: true },
    disposal: {
      type: 'store_community', handler: '赵伟', handlerRole: 'volunteer',
      channel: '社区服务中心储物架 A2', note: '公益本场承接已满，家长选择寄存社区，下一场继续交换或转捐',
      incidentId: 'inc5', at: now - 0.3 * H,
    },
    history: [submitted('陈静', now - 26 * H), approvedH(now - 24 * H), checkedIn(now - 3 * H), h(now - 1 * H, '系统', '无人交换'), h(now - 0.8 * H, '陈静', '申请公益转捐'), h(now - 0.6 * H, '刘洋', '公益拒收', '本场承接名额已满'), h(now - 0.3 * H, '赵伟', '寄存社区', '寄存至社区服务中心储物架 A2，现场处理人赵伟')],
  }),
  // ---------- 破损拒收后环保回收 ----------
  mk({
    id: 'itm_028', code: 'SW-1028', parentId: 'u_p1', name: '破旧毛绒兔子', category: 'toy', condition: 'fair',
    emoji: '🐰', disinfected: true, desired: ['book'], value: [0, 20], age: [0, 6],
    slots: [S2], donation: true, status: 'recycled',
    review: { by: '王芳', at: now - 24 * H, result: 'approved' },
    checkIn: { at: now - 3 * H, by: '赵伟', photoMatch: true, damage: 'minor', disinfectedConfirmed: true, note: '腹部缝线开裂，有填充物外露风险', passed: true },
    disposal: {
      type: 'recycle', handler: '王芳', handlerRole: 'staff',
      channel: '社区再生资源回收点（织物回收箱）', note: '破损不符合捐赠标准，家长确认后环保回收',
      incidentId: 'inc4', at: now - 0.2 * H,
    },
    history: [submitted('王晓', now - 26 * H), approvedH(now - 24 * H), checkedIn(now - 3 * H), h(now - 1 * H, '系统', '无人交换'), h(now - 0.8 * H, '王晓', '申请公益转捐'), h(now - 0.6 * H, '刘洋', '公益拒收', '缝线开裂、填充物外露，不符合捐赠标准'), h(now - 0.2 * H, '王芳', '环保回收', '家长确认放弃，投入织物回收箱，现场处理人王芳')],
  }),
]

export function createSeedDB(): DB {
  return {
    users,
    items,
    matches: [
      {
        id: 'm1', itemAId: 'itm_009', itemBId: 'itm_010', score: 95,
        reasons: ['双方期望品类互相契合', '价值区间接近', '可到场时间重合（09:00-10:30）', '双方均已消毒'],
        status: 'proposed', createdAt: now - 20 * H,
      },
      {
        id: 'm2', itemAId: 'itm_011', itemBId: 'itm_012', score: 80,
        reasons: ['双方期望品类互相契合', '适用年龄段契合', '价值区间接近'],
        status: 'confirmed', booth: 'B-01', entryTime: S1, createdAt: now - 19 * H,
      },
      {
        id: 'm3', itemAId: 'itm_013', itemBId: 'itm_014', score: 75,
        reasons: ['双方期望品类互相契合', '价值区间接近', '双方均已消毒'],
        status: 'confirmed', booth: 'B-02', entryTime: S1, createdAt: now - 18 * H,
      },
      {
        id: 'm4', itemAId: 'itm_015', itemBId: 'itm_016', score: 85,
        reasons: ['双方期望品类互相契合', '价值区间接近'],
        status: 'completed', booth: 'B-03', entryTime: S1, createdAt: now - 18 * H,
      },
    ],
    incidents: [
      {
        id: 'inc1', itemId: 'itm_013', matchId: 'm3', type: 'value_dispute',
        title: '积木桌与英语分级读物的价值争议',
        status: 'open',
        logs: [
          { at: now - 1 * H, actor: '赵伟', role: 'volunteer', message: '现场交换时，李敏认为积木桌成色与照片描述有差距，双方对价值是否对等存在争议，请社区协调。' },
        ],
        createdBy: '赵伟', createdAt: now - 1 * H,
      },
      {
        id: 'inc2', itemId: 'itm_020', type: 'photo_mismatch',
        title: '婴儿连体衣实物与照片色差确认',
        status: 'resolved',
        logs: [
          { at: now - 5 * H, actor: '赵伟', role: 'volunteer', message: '核销时发现实物颜色比照片略浅，疑似色差，请社区确认。' },
          { at: now - 4.5 * H, actor: '王芳', role: 'staff', message: '现场比对为同款衣物，系拍照光线问题，已补拍照片存档。' },
        ],
        resolution: '确认为同款物品，色差系光线问题，物品继续参与交换流程。',
        createdBy: '赵伟', createdAt: now - 5 * H,
      },
      {
        id: 'inc3', itemId: 'itm_024', type: 'charity_damaged',
        title: '「小熊绘本 10 本」公益机构破损拒收',
        status: 'open',
        logs: [
          { at: now - 0.5 * H, actor: '刘洋', role: 'charity', message: '该书书角卷边且有明显水渍，不符合公益捐赠标准，已现场拒收。物品退回家长，请社区协助家长在「带回 / 寄存社区 / 预约下一场 / 环保回收」中确认去向，现场处理人请登记。' },
        ],
        createdBy: '刘洋', createdAt: now - 0.5 * H,
      },
      {
        id: 'inc4', itemId: 'itm_028', type: 'charity_damaged',
        title: '「破旧毛绒兔子」公益机构破损拒收',
        status: 'resolved',
        onsiteHandler: '王芳',
        logs: [
          { at: now - 0.6 * H, actor: '刘洋', role: 'charity', message: '毛绒兔子腹部缝线开裂、填充物外露，存在安全隐患，不符合捐赠标准，拒收并退回家长确认。' },
          { at: now - 0.2 * H, actor: '王芳', role: 'staff', message: '已联系家长王晓到场确认，家长同意放弃物品并环保回收，已投入社区织物回收箱。' },
        ],
        resolution: '破损物品无法转赠，家长确认放弃，由社区投入再生资源织物回收箱环保回收，现场处理人：王芳。',
        createdBy: '刘洋', createdAt: now - 0.6 * H,
      },
      {
        id: 'inc5', itemId: 'itm_027', type: 'charity_capacity',
        title: '「涂色本一摞（约 15 本）」公益承接超上限',
        status: 'resolved',
        onsiteHandler: '赵伟',
        logs: [
          { at: now - 0.6 * H, actor: '刘洋', role: 'charity', message: '本场承接名额（3 件）已用完，无法继续接收，请协调家长带回、寄存社区或预约下一场。' },
          { at: now - 0.3 * H, actor: '赵伟', role: 'volunteer', message: '家长陈静选择寄存社区，已放入社区服务中心储物架 A2 并登记。' },
        ],
        resolution: '家长选择寄存到社区服务中心（储物架 A2），下一场活动继续交换或转捐，现场处理人：赵伟。',
        createdBy: '刘洋', createdAt: now - 0.6 * H,
      },
    ],
    donations: [
      { id: 'd1', itemId: 'itm_020', charityId: 'u_charity', status: 'received', note: '送往山区幼儿园', handoverId: 'ho1', createdAt: now - 1.2 * H, respondedAt: now - 1 * H },
      { id: 'd2', itemId: 'itm_019', charityId: 'u_charity', status: 'requested', createdAt: now - 0.5 * H },
      { id: 'd3', itemId: 'itm_024', charityId: 'u_charity', status: 'declined', declineReason: 'damaged', note: '书角卷边且有明显水渍，不符合捐赠标准', createdAt: now - 1 * H, respondedAt: now - 0.5 * H },
      { id: 'd4', itemId: 'itm_025', charityId: 'u_charity', status: 'requested', createdAt: now - 0.5 * H },
      { id: 'd5', itemId: 'itm_026', charityId: 'u_charity', status: 'requested', createdAt: now - 0.5 * H },
      { id: 'd6', itemId: 'itm_027', charityId: 'u_charity', status: 'declined', declineReason: 'over_capacity', note: '本场承接名额已满', createdAt: now - 0.8 * H, respondedAt: now - 0.6 * H },
      { id: 'd7', itemId: 'itm_028', charityId: 'u_charity', status: 'declined', declineReason: 'damaged', note: '缝线开裂、填充物外露，存在安全隐患', createdAt: now - 0.8 * H, respondedAt: now - 0.6 * H },
    ],
    charityProfiles: [
      {
        charityId: 'u_charity',
        acceptAgeRange: [3, 9],
        capacityLimit: 3,
        pickupWindow: '活动结束后 3 天内（9月28日–30日）每日 9:00–17:00 上门取件',
        invoiceNeeded: true,
        invoiceNote: '需开具公益事业捐赠票据，抬头：春芽公益发展中心',
        updatedAt: now - 24 * H,
      },
    ],
    handovers: [
      {
        id: 'ho1',
        code: 'HO-2609-01',
        donationId: 'd1',
        itemId: 'itm_020',
        charityId: 'u_charity',
        parentId: 'u_p3',
        eventName: '阳光社区第三届亲子旧物交换日',
        items: [{ name: '婴儿连体衣 5 件', qty: 5, condition: '七成新' }],
        photos: ['👶'],
        charityHandler: '刘洋',
        staffHandler: '王芳',
        pickupWindow: '2026-09-28（周一）上午 9:00–11:00 上门取件',
        invoiceNeeded: true,
        invoiceNote: '公益事业捐赠票据 · 抬头：春芽公益发展中心',
        destination: '统一消杀后送往云南山区幼儿园',
        viewedByParent: true,
        createdAt: now - 1 * H,
      },
    ],
    event: {
      id: 'ev1',
      name: '阳光社区第三届亲子旧物交换日',
      date: '2026-09-27（周日）09:00–16:30',
      venue: '阳光社区文化活动中心广场',
      phase: 'onsite',
      boothCapacity: 12,
      timeSlots: [S1, S2, S3, S4],
    },
  }
}
