import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type {
  Category, CharityProfile, CheckInRecord, DB, DisposalType, Donation,
  DonationDeclineReason, EventPhase, Handover, Incident, IncidentType,
  Item, ItemStatus, Match, MatchStatus, User,
} from '../types'
import { createSeedDB } from '../seed'
import { autoMatch, commonSlot, recommendFor, scorePair, uid } from '../utils'
import { CATEGORY_META, DISPOSAL_META } from '../meta'

const DB_KEY = 'swapmeet-db-v2'

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      // 兼容旧版数据结构：补齐公益承接相关集合
      if (!parsed.charityProfiles) parsed.charityProfiles = []
      if (!parsed.handovers) parsed.handovers = []
      return parsed
    }
  } catch {
    /* 数据损坏时重新播种 */
  }
  const db = createSeedDB()
  localStorage.setItem(DB_KEY, JSON.stringify(db))
  return db
}

export interface ResolveEffects {
  itemStatus?: ItemStatus
  counterpartStatus?: ItemStatus
  matchStatus?: MatchStatus
  /** 办结时同时登记物品终态去向 */
  disposal?: {
    type: DisposalType
    handler: string
    channel?: string
    note?: string
  }
}

export interface DonationEligibility {
  /** 剩余承接名额 */
  capacityLeft: number
  capacityOk: boolean
  ageOk: boolean
  ageOverlap: boolean
  damaged: boolean
  damageLevel: CheckInRecord['damage'] | undefined
  ok: boolean
  warnings: string[]
  blocks: string[]
}

export interface HandoverInput {
  charityHandler: string
  staffHandler?: string
  destination?: string
  extraPhotos?: string[]
}

export const useDataStore = defineStore('data', () => {
  const db = ref<DB>(loadDB())

  watch(db, (v) => localStorage.setItem(DB_KEY, JSON.stringify(v)), { deep: true })

  // ---------- 基础查询 ----------
  const event = computed(() => db.value.event)
  const users = computed(() => db.value.users)
  const items = computed(() => db.value.items)
  const matches = computed(() => db.value.matches)
  const incidents = computed(() => db.value.incidents)
  const donations = computed(() => db.value.donations)
  const handovers = computed(() => db.value.handovers)

  const userById = (id: string): User | undefined => db.value.users.find((u) => u.id === id)
  const itemById = (id: string): Item | undefined => db.value.items.find((i) => i.id === id)
  const itemByCode = (code: string): Item | undefined =>
    db.value.items.find((i) => i.code.toLowerCase() === code.trim().toLowerCase())
  const matchById = (id: string): Match | undefined => db.value.matches.find((m) => m.id === id)
  const handoverById = (id: string): Handover | undefined => db.value.handovers.find((x) => x.id === id)
  const handoverByItem = (itemId: string): Handover | undefined =>
    db.value.handovers.find((x) => x.itemId === itemId)
  const donationByItem = (itemId: string): Donation | undefined =>
    db.value.donations.find((d) => d.itemId === itemId && d.status !== 'declined')

  const itemsByParent = (pid: string) => db.value.items.filter((i) => i.parentId === pid)
  const pendingItems = computed(() => db.value.items.filter((i) => i.status === 'pending'))
  const approvedPool = computed(() => db.value.items.filter((i) => i.status === 'approved'))
  const freeZoneItems = computed(() => db.value.items.filter((i) => i.status === 'free_zone'))
  const reservedItems = computed(() => db.value.items.filter((i) => i.status === 'reserved'))
  const arrivedItems = computed(() => db.value.items.filter((i) => ['arrived', 'verified'].includes(i.status)))

  const matchesForItem = (itemId: string) =>
    db.value.matches.filter((m) => m.itemAId === itemId || m.itemBId === itemId)
  const activeMatchForItem = (itemId: string) =>
    matchesForItem(itemId).find((m) => ['proposed', 'accepted_a', 'accepted_b', 'confirmed'].includes(m.status))

  const incidentsForItem = (itemId: string) => db.value.incidents.filter((i) => i.itemId === itemId)
  const openIncidents = computed(() => db.value.incidents.filter((i) => i.status !== 'resolved'))

  /** 已占用摊位 = 已确认组合的摊位 ∪ 物品身上已分配的摊位（含未到场保留摊位） */
  const boothUsed = computed(() => {
    const used = new Set<string>()
    for (const m of db.value.matches) if (m.status === 'confirmed' && m.booth) used.add(m.booth)
    for (const i of db.value.items) {
      if (i.booth && ['reserved', 'no_show', 'arrived', 'verified', 'exchanged', 'disputed'].includes(i.status)) {
        used.add(i.booth)
      }
    }
    return used.size
  })

  function pushHistory(item: Item, actor: string, action: string, detail?: string) {
    item.history.push({ at: Date.now(), actor, action, detail })
  }

  // ---------- 公益机构承接设置 ----------
  function charityProfile(charityId: string): CharityProfile | undefined {
    return db.value.charityProfiles.find((p) => p.charityId === charityId)
  }

  function saveCharityProfile(
    charityId: string,
    payload: Omit<CharityProfile, 'charityId' | 'updatedAt'>,
  ) {
    const idx = db.value.charityProfiles.findIndex((p) => p.charityId === charityId)
    const profile: CharityProfile = { ...payload, charityId, updatedAt: Date.now() }
    if (idx >= 0) db.value.charityProfiles[idx] = profile
    else db.value.charityProfiles.push(profile)
  }

  /** 公益机构本场已接收件数 */
  const charityReceivedCount = (charityId: string) =>
    db.value.donations.filter((d) => d.charityId === charityId && d.status === 'received').length

  /** 公益机构剩余承接名额（无设置时视为不限） */
  function charityRemaining(charityId: string): number {
    const p = charityProfile(charityId)
    if (!p) return Infinity
    return Math.max(0, p.capacityLimit - charityReceivedCount(charityId))
  }

  /** 判断某件待接收捐赠是否符合公益机构承接条件 */
  function evaluateDonation(donationId: string): DonationEligibility | null {
    const d = db.value.donations.find((x) => x.id === donationId)
    const item = d ? itemById(d.itemId) : undefined
    const profile = d ? charityProfile(d.charityId) : undefined
    if (!d || !item || !profile) return null

    const capacityLeft = Math.max(0, profile.capacityLimit - charityReceivedCount(d.charityId))
    const capacityOk = capacityLeft > 0
    // 年龄段有交集即视为适合（如物品 6–12 岁，机构接收 3–9 岁，6–9 岁部分重合）
    const ageOverlap =
      item.ageRange[0] <= profile.acceptAgeRange[1] && profile.acceptAgeRange[0] <= item.ageRange[1]
    const damageLevel = item.checkIn?.damage
    const damaged = damageLevel === 'severe'

    const warnings: string[] = []
    const blocks: string[] = []
    if (!capacityOk) blocks.push(`本场承接上限 ${profile.capacityLimit} 件已用完`)
    if (!ageOverlap) {
      blocks.push(`物品适合 ${item.ageRange[0]}–${item.ageRange[1]} 岁，不在机构接收的 ${profile.acceptAgeRange[0]}–${profile.acceptAgeRange[1]} 岁范围`)
    }
    if (damaged) blocks.push('核销记录显示物品严重破损，不符合捐赠标准')
    if (damageLevel === 'minor') warnings.push('核销记录显示物品有轻微破损，接收前请现场复核')

    return {
      capacityLeft,
      capacityOk,
      ageOk: ageOverlap,
      ageOverlap,
      damaged,
      damageLevel,
      ok: blocks.length === 0,
      warnings,
      blocks,
    }
  }

  // ---------- 报名与审核 ----------
  function submitItem(payload: Omit<Item, 'id' | 'code' | 'status' | 'history' | 'createdAt'>, actor: string): Item {
    const item: Item = {
      ...payload,
      id: uid('itm'),
      code: `SW-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'pending',
      history: [],
      createdAt: Date.now(),
    }
    pushHistory(item, actor, '提交报名', '填写物品信息并提交审核')
    db.value.items.unshift(item)
    return item
  }

  function reviewItem(id: string, result: 'approved' | 'rejected', by: string, reason?: string) {
    const item = itemById(id)
    if (!item || item.status !== 'pending') return
    item.review = { by, at: Date.now(), result, reason }
    item.status = result
    pushHistory(item, by, result === 'approved' ? '审核通过' : '审核驳回', reason)
  }

  // ---------- 撮合 ----------
  function createMatch(a: Item, b: Item, actor: string): Match | null {
    const { score, reasons } = scorePair(a, b)
    const match: Match = {
      id: uid('m'), itemAId: a.id, itemBId: b.id, score, reasons,
      status: 'proposed', createdAt: Date.now(),
    }
    db.value.matches.unshift(match)
    for (const it of [a, b]) {
      it.status = 'matched'
      pushHistory(it, actor, '发起撮合', `与「${it.id === a.id ? b.name : a.name}」配对，待双方确认`)
    }
    return match
  }

  /** 一键智能撮合：返回生成的组合数 */
  function runAutoMatch(actor: string): number {
    const pool = approvedPool.value
    const pairs = autoMatch(pool, db.value.event.boothCapacity, boothUsed.value)
    for (const p of pairs) createMatch(p.a, p.b, actor)
    return pairs.length
  }

  /** 家长从推荐列表发起撮合 */
  function proposeFromRecommendation(itemId: string, targetId: string, actor: string): boolean {
    const a = itemById(itemId)
    const b = itemById(targetId)
    if (!a || !b || a.status !== 'approved' || b.status !== 'approved') return false
    createMatch(a, b, actor)
    return true
  }

  function recommendationsFor(itemId: string) {
    const item = itemById(itemId)
    if (!item) return []
    return recommendFor(item, approvedPool.value)
  }

  /** 家长确认/拒绝撮合 */
  function respondMatch(matchId: string, userId: string, accept: boolean, actor: string) {
    const match = matchById(matchId)
    if (!match) return
    const a = itemById(match.itemAId)
    const b = itemById(match.itemBId)
    if (!a || !b) return
    const isA = a.parentId === userId
    const isB = b.parentId === userId
    if (!isA && !isB) return

    if (!accept) {
      match.status = 'declined'
      for (const it of [a, b]) {
        it.status = 'approved'
        pushHistory(it, actor, '拒绝撮合', '组合解除，物品回到待撮合池')
      }
      return
    }

    if (isA) match.status = match.status === 'accepted_b' ? 'confirmed' : 'accepted_a'
    if (isB) match.status = match.status === 'accepted_a' ? 'confirmed' : 'accepted_b'
    pushHistory(isA ? a : b, actor, '接受撮合', match.status === 'confirmed' ? '双方均已确认' : '等待对方确认')

    if (match.status === 'confirmed') {
      const boothNo = boothUsed.value + 1
      match.booth = `B-${String(boothNo).padStart(2, '0')}`
      match.entryTime = commonSlot(a, b, db.value.event.timeSlots)
      for (const it of [a, b]) {
        it.status = 'reserved'
        it.booth = match.booth
        it.entryTime = match.entryTime
        pushHistory(it, '系统', '预约成功', `摊位 ${match.booth}，入场时段 ${match.entryTime}`)
      }
    }
  }

  /** 未匹配物品进入自由交换区 */
  function moveUnmatchedToFreeZone(actor: string): number {
    let n = 0
    for (const it of db.value.items.filter((i) => i.status === 'approved')) {
      it.status = 'free_zone'
      pushHistory(it, actor, '转入自由交换区', '本轮未匹配成功')
      n += 1
    }
    return n
  }

  // ---------- 现场核销 ----------
  function checkIn(itemId: string, record: Omit<CheckInRecord, 'at'>, actor: string): Item | null {
    const item = itemById(itemId)
    if (!item) return null
    const rec: CheckInRecord = { ...record, at: Date.now() }
    item.checkIn = rec
    if (rec.passed) {
      item.status = 'verified'
      pushHistory(item, actor, '扫码核销', '物品到场，核验通过')
    } else {
      item.status = 'disputed'
      pushHistory(item, actor, '核销存疑', rec.note ?? '核验未通过，转入异常处理')
      reportIncident({
        itemId: item.id,
        type: 'photo_mismatch',
        title: `「${item.name}」核销异常`,
        message: rec.note ?? (!rec.photoMatch ? '实物与报名照片不符' : '现场核验未通过'),
        by: actor,
        role: 'volunteer',
        changeItemStatus: false,
      })
    }
    return item
  }

  /** 确认一组预约交换完成 */
  function confirmExchange(matchId: string, actor: string): boolean {
    const match = matchById(matchId)
    if (!match || match.status !== 'confirmed') return false
    const a = itemById(match.itemAId)
    const b = itemById(match.itemBId)
    if (!a || !b) return false
    if (a.status !== 'verified' || b.status !== 'verified') return false
    match.status = 'completed'
    for (const it of [a, b]) {
      it.status = 'exchanged'
      const other = it.id === a.id ? b : a
      pushHistory(it, actor, '交换成功', `与「${other.name}」完成交换`)
    }
    return true
  }

  /** 自由交换区现场登记交换 */
  function onsiteFreeExchange(aId: string, bId: string, actor: string): boolean {
    const a = itemById(aId)
    const b = itemById(bId)
    if (!a || !b || a.id === b.id) return false
    const ok = (s: ItemStatus) => ['verified', 'arrived', 'free_zone', 'no_exchange'].includes(s)
    if (!ok(a.status) || !ok(b.status)) return false
    const { score, reasons } = scorePair(a, b)
    const match: Match = {
      id: uid('m'), itemAId: a.id, itemBId: b.id, score, reasons,
      status: 'completed', onsite: true, createdAt: Date.now(),
    }
    db.value.matches.unshift(match)
    for (const it of [a, b]) {
      it.status = 'exchanged'
      const other = it.id === a.id ? b : a
      pushHistory(it, actor, '自由交换成功', `在自由交换区与「${other.name}」完成交换`)
    }
    return true
  }

  /** 预约物品未到场 */
  function markNoShow(itemId: string, actor: string) {
    const item = itemById(itemId)
    if (!item || !['reserved', 'matched'].includes(item.status)) return
    item.status = 'no_show'
    pushHistory(item, actor, '标记未到场', '超过入场时段未到')
    const match = activeMatchForItem(itemId)
    reportIncident({
      itemId, matchId: match && match.status === 'confirmed' ? match.id : undefined,
      type: 'no_show', title: `「${item.name}」家长临时缺席`,
      message: '超过预约入场时段仍未到场，请社区联系家长并处理配对物品。',
      by: actor, role: 'volunteer', changeItemStatus: false,
    })
  }

  /** 自由交换区/无人交换物品家长带回 */
  function takeBack(itemId: string, actor: string) {
    const item = itemById(itemId)
    if (!item) return
    applyDisposal(item, 'take_back', { handler: actor, handlerRole: 'parent' })
  }

  // ---------- 异常 / 争议 ----------
  function reportIncident(payload: {
    itemId: string
    matchId?: string
    type: IncidentType
    title: string
    message: string
    by: string
    role: User['role']
    changeItemStatus?: boolean
  }): Incident {
    const incident: Incident = {
      id: uid('inc'),
      itemId: payload.itemId,
      matchId: payload.matchId,
      type: payload.type,
      title: payload.title,
      status: 'open',
      logs: [{ at: Date.now(), actor: payload.by, role: payload.role, message: payload.message }],
      createdBy: payload.by,
      createdAt: Date.now(),
    }
    db.value.incidents.unshift(incident)
    const item = itemById(payload.itemId)
    if (item && payload.changeItemStatus !== false && item.status !== 'disputed') {
      item.status = 'disputed'
      pushHistory(item, payload.by, '上报异常', payload.title)
    }
    return incident
  }

  function addIncidentLog(incidentId: string, actor: string, role: User['role'], message: string) {
    const inc = db.value.incidents.find((i) => i.id === incidentId)
    if (!inc || !message.trim()) return
    inc.logs.push({ at: Date.now(), actor, role, message: message.trim() })
    if (inc.status === 'open') inc.status = 'processing'
  }

  function resolveIncident(incidentId: string, actor: string, resolution: string, effects: ResolveEffects) {
    const inc = db.value.incidents.find((i) => i.id === incidentId)
    if (!inc) return
    inc.status = 'resolved'
    inc.resolution = resolution
    inc.onsiteHandler = effects.disposal?.handler ?? actor
    inc.logs.push({ at: Date.now(), actor, role: 'staff', message: `【处理结论】${resolution}` })

    const item = itemById(inc.itemId)
    if (item && effects.disposal) {
      applyDisposal(item, effects.disposal.type, {
        handler: effects.disposal.handler,
        handlerRole: 'staff',
        channel: effects.disposal.channel,
        note: effects.disposal.note,
        incidentId: inc.id,
      })
    } else if (item && effects.itemStatus) {
      item.status = effects.itemStatus
      pushHistory(item, actor, '争议处理完成', resolution)
    }
    const match = inc.matchId ? matchById(inc.matchId) : activeMatchForItem(inc.itemId)
    if (match && effects.matchStatus) match.status = effects.matchStatus
    if (match && effects.counterpartStatus) {
      const otherId = match.itemAId === inc.itemId ? match.itemBId : match.itemAId
      const other = itemById(otherId)
      if (other) {
        other.status = effects.counterpartStatus
        pushHistory(other, actor, '关联处理', `配对物品处理：${resolution}`)
      }
    }
  }

  // ---------- 终态去向（带回 / 寄存社区 / 预约下一场 / 环保回收） ----------
  function applyDisposal(
    item: Item,
    type: DisposalType,
    payload: { handler: string; handlerRole: User['role']; channel?: string; note?: string; incidentId?: string },
  ) {
    const meta = DISPOSAL_META[type]
    item.status = meta.status
    item.disposal = {
      type,
      handler: payload.handler,
      handlerRole: payload.handlerRole,
      channel: payload.channel,
      note: payload.note,
      incidentId: payload.incidentId,
      at: Date.now(),
    }
    const extra = payload.channel ? `；${payload.channel}` : ''
    pushHistory(item, payload.handler, meta.label, `${meta.icon} 现场处理人：${payload.handler}${extra}${payload.note ? `（${payload.note}）` : ''}`)
    // 关联的未结异常单同步办结
    if (payload.incidentId) {
      const inc = db.value.incidents.find((x) => x.id === payload.incidentId && x.status !== 'resolved')
      if (inc) {
        inc.status = 'resolved'
        inc.resolution = `${meta.label}，现场处理人：${payload.handler}${payload.channel ? `，${payload.channel}` : ''}`
        inc.onsiteHandler = payload.handler
      }
    }
  }

  /** 家长/现场人员对物品选择终态去向（超上限或破损拒收后） */
  function disposeItem(
    itemId: string,
    type: DisposalType,
    payload: { handler: string; handlerRole: User['role']; channel?: string; note?: string },
  ): boolean {
    const item = itemById(itemId)
    if (!item) return false
    const related = db.value.incidents.find(
      (x) => x.itemId === itemId && x.status !== 'resolved' && (x.type === 'charity_damaged' || x.type === 'charity_capacity'),
    )
    applyDisposal(item, type, { ...payload, incidentId: related?.id })
    return true
  }

  // ---------- 捐赠 ----------
  function requestDonation(itemId: string, actor: string): Donation | null {
    const item = itemById(itemId)
    const charity = db.value.users.find((u) => u.role === 'charity')
    if (!item || !charity) return null
    if (db.value.donations.some((d) => d.itemId === itemId && d.status !== 'declined')) return null
    const donation: Donation = {
      id: uid('d'), itemId, charityId: charity.id, status: 'requested', createdAt: Date.now(),
    }
    db.value.donations.unshift(donation)
    pushHistory(item, actor, '申请公益转捐', `等待「${charity.orgName}」接收`)
    return donation
  }

  /** 公益机构确认接收：校验承接条件并生成交接清单 */
  function receiveDonation(donationId: string, actor: string, input: HandoverInput): Handover | null {
    const d = db.value.donations.find((x) => x.id === donationId)
    if (!d || d.status !== 'requested') return null
    const item = itemById(d.itemId)
    const charity = userById(d.charityId)
    const profile = charityProfile(d.charityId)
    if (!item || !charity || !profile) return null
    const eligibility = evaluateDonation(donationId)
    if (!eligibility || !eligibility.ok) return null

    const dnow = new Date()
    const code = `HO-${String(dnow.getMonth() + 1).padStart(2, '0')}${String(dnow.getDate()).padStart(2, '0')}-${String(
      db.value.handovers.length + 1,
    ).padStart(2, '0')}`

    const handover: Handover = {
      id: uid('ho'),
      code,
      donationId: d.id,
      itemId: item.id,
      charityId: charity.id,
      parentId: item.parentId,
      eventName: db.value.event.name,
      items: [
        {
          name: item.name,
          // 名称中带「N 件/本/个/套/盒/箱」时取该数量，「500 片」这类按片描述的视为 1 件
          qty: (() => {
            const m = item.name.match(/(\d+)\s*(?:件|本|个|套|盒|箱)/)
            return m ? Number(m[1]) : 1
          })(),
          condition: { new: '全新', like_new: '九成新', good: '七成新', fair: '五成新' }[item.condition],
        },
      ],
      photos: [...item.photos, ...(input.extraPhotos ?? [])],
      charityHandler: input.charityHandler,
      staffHandler: input.staffHandler,
      pickupWindow: profile.pickupWindow,
      invoiceNeeded: profile.invoiceNeeded,
      invoiceNote: profile.invoiceNote,
      destination: input.destination,
      viewedByParent: false,
      createdAt: Date.now(),
    }
    db.value.handovers.unshift(handover)

    d.status = 'received'
    d.note = input.destination
    d.handoverId = handover.id
    d.respondedAt = Date.now()

    item.status = 'donated'
    pushHistory(
      item,
      actor,
      '公益接收',
      `${charity.orgName} 现场清点接收并生成交接清单 ${code}，运输时间：${profile.pickupWindow}${
        input.destination ? `，去向：${input.destination}` : ''
      }`,
    )
    return handover
  }

  /** 公益机构拒收：破损 → 退回家长确认；超上限/年龄段不符 → 生成协调异常 */
  function declineDonation(donationId: string, reason: DonationDeclineReason, note: string, actor: string) {
    const d = db.value.donations.find((x) => x.id === donationId)
    if (!d || d.status !== 'requested') return
    const item = itemById(d.itemId)
    const charity = userById(d.charityId)
    if (!item || !charity) return

    d.status = 'declined'
    d.note = note
    d.declineReason = reason
    d.respondedAt = Date.now()

    if (reason === 'damaged') {
      item.status = 'parent_confirm'
      pushHistory(item, actor, '公益破损拒收', note || '物品破损，不符合捐赠标准，退回家长确认去向')
      reportIncident({
        itemId: item.id, type: 'charity_damaged',
        title: `「${item.name}」公益机构破损拒收`,
        message: `${charity.orgName} 现场复核认为物品破损（${note || '不符合捐赠标准'}），已拒收。请家长在「带回 / 环保回收」中确认去向；选择环保回收时由社区或志愿者现场处理并登记处理人。`,
        by: actor, role: 'charity', changeItemStatus: false,
      })
    } else {
      const reasonText =
        reason === 'over_capacity' ? '本场承接名额已满'
        : reason === 'age_unfit' ? '物品年龄段不在机构接收范围'
        : reason === 'category_unfit' ? '物品品类不在机构接收范围'
        : note || '无法接收'
      pushHistory(item, actor, '公益拒收', reasonText)
      reportIncident({
        itemId: item.id, type: 'charity_capacity',
        title: `「${item.name}」公益承接超上限`,
        message: `${charity.orgName} 无法接收该物品：${reasonText}${note && reason !== 'other' ? `（${note}）` : ''}。已提示家长选择自行带回、寄存到社区或预约下一场活动。`,
        by: actor, role: 'charity', changeItemStatus: false,
      })
    }
  }

  /** 家长查看捐赠去向（交接清单） */
  function markHandoverViewed(handoverId: string) {
    const ho = db.value.handovers.find((x) => x.id === handoverId)
    if (ho && !ho.viewedByParent) ho.viewedByParent = true
  }

  // ---------- 活动阶段 ----------
  function setPhase(phase: EventPhase, actor: string) {
    db.value.event.phase = phase
    void actor
  }

  function resetAll() {
    db.value = createSeedDB()
  }

  // ---------- 活动总结统计 ----------
  const summary = computed(() => {
    const all = db.value.items
    const submittedCount = all.length
    const reviewed = all.filter((i) => i.review)
    const approvedCount = reviewed.filter((i) => i.review?.result === 'approved').length
    const arrived = all.filter((i) => i.checkIn)
    const exchanged = all.filter((i) => i.status === 'exchanged')
    const noShow = all.filter((i) => i.status === 'no_show')
    const donated = all.filter((i) => i.status === 'donated')
    const takenBack = all.filter((i) => i.status === 'taken_back')
    const noExchange = all.filter((i) => i.status === 'no_exchange')
    const storedCommunity = all.filter((i) => i.status === 'stored_community')
    const nextEvent = all.filter((i) => i.status === 'next_event')
    const recycled = all.filter((i) => i.status === 'recycled')
    const parentConfirm = all.filter((i) => i.status === 'parent_confirm')

    // 品类供需缺口（仅统计可交换品类）
    const gap = (['toy', 'book', 'clothing', 'study', 'baby'] as Category[]).map((c) => {
      const supply = all.filter((i) => i.category === c && i.review?.result === 'approved').length
      const demand = all.filter((i) => i.desiredCategories.includes(c)).length
      return { category: c, label: CATEGORY_META[c].label, icon: CATEGORY_META[c].icon, supply, demand, gap: demand - supply }
    })

    // 预约到场率 = 实际到场（有核销记录）/ 曾经预约成功（含当前已预约、已到场、未到场）
    const everReserved = all.filter(
      (i) => i.status === 'reserved' || i.status === 'no_show' || i.checkIn,
    )
    const arrivalRate = everReserved.length ? Math.round((arrived.length / everReserved.length) * 100) : 0

    return {
      submittedCount,
      reviewedCount: reviewed.length,
      approvedCount,
      rejectedCount: reviewed.length - approvedCount,
      arrivedCount: arrived.length,
      exchangedCount: exchanged.length,
      successRate: arrived.length ? Math.round((exchanged.length / arrived.length) * 100) : 0,
      arrivalRate,
      noShow,
      donated,
      takenBack,
      noExchange,
      storedCommunity,
      nextEvent,
      recycled,
      parentConfirm,
      handovers: db.value.handovers,
      gap,
    }
  })

  return {
    db, event, users, items, matches, incidents, donations, handovers,
    userById, itemById, itemByCode, matchById, handoverById, handoverByItem, donationByItem,
    itemsByParent, pendingItems, approvedPool, freeZoneItems, reservedItems, arrivedItems,
    matchesForItem, activeMatchForItem, incidentsForItem, openIncidents, boothUsed,
    submitItem, reviewItem,
    runAutoMatch, proposeFromRecommendation, recommendationsFor, respondMatch, moveUnmatchedToFreeZone,
    checkIn, confirmExchange, onsiteFreeExchange, markNoShow, takeBack,
    reportIncident, addIncidentLog, resolveIncident,
    charityProfile, saveCharityProfile, charityRemaining, charityReceivedCount, evaluateDonation,
    requestDonation, receiveDonation, declineDonation, disposeItem, markHandoverViewed,
    setPhase, resetAll, summary,
  }
})
