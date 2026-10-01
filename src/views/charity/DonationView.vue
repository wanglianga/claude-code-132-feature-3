<template>
  <AppShell>
    <h2 class="page-title">捐赠接收</h2>
    <p class="page-desc">
      活动结束时仍有大量绘本无人交换：在此标记可接收年龄段与数量上限、运输时间和开票需求；
      超过承接上限的物品请家长带回、寄存社区或预约下一场；破损物品拒收并记录现场处理人
    </p>

    <!-- 承接能力总览 -->
    <div class="grid cols-4">
      <div class="card stat-card"><div class="num">{{ cap.remaining }}</div><div class="lbl">总剩余承接能力（件）</div></div>
      <div class="card stat-card"><div class="num" style="color: var(--pink)">{{ received.length }}</div><div class="lbl">本场已接收</div></div>
      <div class="card stat-card"><div class="num" style="color: var(--amber)">{{ requested.length }}</div><div class="lbl">待处理申请</div></div>
      <div class="card stat-card"><div class="num" style="color: var(--red)">{{ declined.length }}</div><div class="lbl">已拒收（待家长/社区跟进）</div></div>
    </div>

    <!-- 承接配置 -->
    <div class="card mt16">
      <div class="row between wrap">
        <div class="card-title" style="margin: 0">🎯 本场承接配置</div>
        <button class="btn sm outline" @click="openConfig">{{ editing ? '收起' : '✏️ 编辑承接年龄段 / 数量 / 运输 / 开票' }}</button>
      </div>

      <!-- 只读概览 -->
      <div v-if="!editing" class="mt12">
        <div class="quota-grid">
          <div v-for="q in profile.quotas" :key="q.label" class="quota-box" :class="{ full: usedOf(q.label) >= q.limit, zero: q.limit <= 0 }">
            <div class="q-age">{{ q.label }}</div>
            <div class="q-num">{{ q.limit <= 0 ? '不接收' : `${usedOf(q.label)}/${q.limit} 件` }}</div>
            <div v-if="q.limit > 0" class="q-bar"><div class="q-fill" :style="{ width: pctUsed(q.label) }" /></div>
          </div>
        </div>
        <div class="tag-list mt12">
          <span class="tag">🚚 运输：{{ profile.transportTime }}</span>
          <span class="tag">🚛 {{ profile.transportMethod }}</span>
          <span class="tag">{{ profile.invoiceSupported ? '🧾 可开捐赠票据' : '🧾 暂不开票' }}</span>
          <span v-if="profile.invoiceSupported" class="tag">{{ profile.invoiceNote }}</span>
        </div>
      </div>

      <!-- 编辑表单 -->
      <div v-else class="mt12">
        <div class="card-title" style="font-size: 13.5px">可接收年龄段与数量上限（0 = 本场不接收该年龄段）</div>
        <div class="quota-edit-row" v-for="(q, i) in form.quotas" :key="q.label">
          <span class="tag" style="min-width: 72px; justify-content: center">{{ q.label }}</span>
          <input v-model.number="q.ageRange0" class="input" type="number" min="0" max="12" style="max-width: 70px" />
          <span>–</span>
          <input v-model.number="q.ageRange1" class="input" type="number" min="0" max="12" style="max-width: 70px" />
          <span>岁，上限</span>
          <input v-model.number="q.limit" class="input" type="number" min="0" max="999" style="max-width: 80px" />
          <span>件 · 已接收 {{ usedOf(q.label) }} 件</span>
        </div>

        <div class="grid cols-2 mt12">
          <div class="field" style="margin: 0">
            <label>运输时间</label>
            <input v-model.trim="form.transportTime" class="input" placeholder="如：活动结束后次日 14:00 上门清运" />
          </div>
          <div class="field" style="margin: 0">
            <label>运输方式</label>
            <input v-model.trim="form.transportMethod" class="input" placeholder="如：厢式货车统一运输" />
          </div>
        </div>

        <label class="check-line mt12">
          <input v-model="form.invoiceSupported" type="checkbox" />
          本场支持开具公益事业捐赠票据
        </label>
        <div class="field mt8" style="margin: 0">
          <label>开票说明</label>
          <input v-model.trim="form.invoiceNote" class="input" placeholder="如：抬头由家长/社区在接收时提供" />
        </div>

        <div class="row mt12">
          <button class="btn primary" @click="saveConfig">💾 保存承接配置</button>
          <button class="btn ghost" @click="editing = false">取消</button>
        </div>
        <p class="hint mt8">保存后立即生效：待处理申请会按年龄段与剩余名额重新校验是否超出承接上限。</p>
      </div>
    </div>

    <!-- 待处理捐赠申请 -->
    <div class="card mt16">
      <div class="card-title">📥 待处理捐赠申请（{{ requested.length }}）</div>
      <template v-if="requested.length">
        <div v-for="d in requested" :key="d.id" class="donation-block">
          <ItemCard :item="itemOf(d)!" show-owner />
          <div class="elig-bar">
            <template v-if="elig(d).ok">
              <span class="notice success" style="margin: 0">
                ✅ 在承接范围内：{{ elig(d).quotaLabel }} 档位剩余
                {{ (elig(d).limit ?? 0) - (elig(d).used ?? 0) }} 件名额
              </span>
            </template>
            <template v-else>
              <span class="notice error" style="margin: 0">⚠️ {{ elig(d).message }}</span>
            </template>
          </div>
          <div class="row wrap">
            <button class="btn sm success" :disabled="!elig(d).ok" @click="openAccept(d)">
              ✅ 确认接收并生成交接清单
            </button>
            <button class="btn sm outline" @click="openDecline(d, 'capacity')">📦 超过承接上限，拒收</button>
            <button class="btn sm outline" @click="openDecline(d, 'age_unfit')">🔢 年龄段不符，拒收</button>
            <button class="btn sm danger" @click="openDecline(d, 'damaged')">🧩 物品破损，拒收</button>
          </div>
        </div>
      </template>
      <EmptyState v-else icon="📥" text="暂无待处理的捐赠申请" />
    </div>

    <!-- 已接收 + 交接清单 -->
    <div class="card">
      <div class="card-title">💚 已接收物品与交接清单（{{ received.length }}）</div>
      <template v-if="received.length">
        <div v-for="d in received" :key="d.id" class="handover-card">
          <div class="row between wrap">
            <div>
              <b>{{ itemOf(d)?.name }}</b>
              <span class="small muted">（{{ itemOf(d)?.code }} · 捐赠家长 {{ parentOf(d) }}）</span>
            </div>
            <span class="badge pink">交接清单 {{ handoverOf(d)?.id.replace('hv', 'HV').toUpperCase() }}</span>
          </div>
          <div class="handover-photos">
            <ItemPhoto
              v-for="(p, i) in handoverOf(d)?.photos ?? []"
              :key="i"
              :photo="p"
              :category="itemOf(d)!.category"
            />
          </div>
          <div class="tag-list mt8">
            <span class="tag">👤 经办人：{{ handoverOf(d)?.handler }}</span>
            <span class="tag">🚚 运输：{{ handoverOf(d)?.transportTime }}</span>
            <span class="tag" v-if="handoverOf(d)?.transportMethod">🚛 {{ handoverOf(d)?.transportMethod }}</span>
            <span class="tag" :class="handoverOf(d)?.invoiceNeeded ? 'pink' : 'slate'">
              {{ handoverOf(d)?.invoiceNeeded ? `🧾 需开票（抬头：${handoverOf(d)?.invoiceTitle || '待补充'}）` : '🧾 无需开票' }}
            </span>
          </div>
          <p class="small muted mt8">去向：{{ handoverOf(d)?.destination }} · 交接时间 {{ fmtTime(handoverOf(d)!.at) }}</p>
        </div>
      </template>
      <EmptyState v-else icon="💚" text="暂无接收记录" />
    </div>

    <!-- 已拒收 -->
    <div class="card">
      <div class="card-title">🚫 已拒收记录（{{ declined.length }}）</div>
      <table v-if="declined.length" class="table">
        <thead><tr><th>物品</th><th>家长</th><th>拒收原因</th><th>现场处理人</th><th>当前去向</th></tr></thead>
        <tbody>
          <tr v-for="d in declined" :key="d.id">
            <td>{{ itemOf(d)?.name }}</td>
            <td>{{ parentOf(d) }}</td>
            <td>
              <b>{{ DECLINE_REASON_META[d.declineReason ?? 'capacity'].label }}</b>
              <div class="small muted">{{ d.note }}{{ d.damageDesc ? `：${d.damageDesc}` : '' }}</div>
            </td>
            <td>{{ d.handler ?? '—' }}</td>
            <td><StatusBadge :status="itemOf(d)!.status" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else icon="🚫" text="暂无拒收记录" />
    </div>

    <!-- 接收弹窗：交接清单 -->
    <div v-if="acceptTarget" class="modal-mask" @click.self="acceptTarget = null">
      <div class="modal" style="width: 560px">
        <div class="modal-head">
          <h3>✅ 接收「{{ itemOf(acceptTarget)?.name }}」· 填写交接清单</h3>
          <button class="modal-close" @click="acceptTarget = null">✕</button>
        </div>
        <p class="small muted mb12">
          归入 {{ acceptElig.quotaLabel }} 档位（已接收 {{ acceptElig.used }}/{{ acceptElig.limit }}），
          接收后家长可凭交接清单与照片查看物品去向
        </p>
        <div class="field">
          <label>现场经办人<span class="req">*</span></label>
          <input v-model.trim="acceptForm.handler" class="input" placeholder="公益机构现场接收人" />
        </div>
        <div class="field">
          <label>物品去向<span class="req">*</span></label>
          <input v-model.trim="acceptForm.destination" class="input" placeholder="如：春芽公益中转站 → 山区幼儿园" />
        </div>
        <div class="grid cols-2">
          <div class="field">
            <label>运输时间<span class="req">*</span></label>
            <input v-model.trim="acceptForm.transportTime" class="input" :placeholder="profile.transportTime" />
          </div>
          <div class="field">
            <label>运输方式</label>
            <input v-model.trim="acceptForm.transportMethod" class="input" :placeholder="profile.transportMethod" />
          </div>
        </div>
        <label class="check-line">
          <input v-model="acceptForm.invoiceNeeded" type="checkbox" />
          需要开具公益事业捐赠票据
        </label>
        <div v-if="acceptForm.invoiceNeeded" class="field mt8">
          <label>票据抬头</label>
          <input v-model.trim="acceptForm.invoiceTitle" class="input" placeholder="如：阳光社区居民委员会 / 捐赠人个人" />
        </div>
        <div class="field mt8">
          <label>交接照片（现场清点装车拍照，最多 3 张）</label>
          <div class="row wrap">
            <div v-for="(p, i) in acceptForm.photos" :key="i" style="position: relative">
              <ItemPhoto :photo="p" :category="itemOf(acceptTarget)!.category" />
              <button
                type="button"
                class="modal-close"
                style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; font-size: 10px"
                @click="acceptForm.photos.splice(i, 1)"
              >✕</button>
            </div>
            <label v-if="acceptForm.photos.length < 3" class="item-photo" style="cursor: pointer; font-size: 24px; color: var(--ink-3)">
              ＋
              <input type="file" accept="image/*" style="display: none" @change="onHandoverPhoto" />
            </label>
          </div>
          <p class="hint">不上传时使用物品报名照片作为交接凭证</p>
        </div>
        <div v-if="acceptError" class="notice error">{{ acceptError }}</div>
        <div class="row">
          <button class="btn success" @click="confirmAccept">✅ 确认接收，生成交接清单</button>
          <button class="btn ghost" @click="acceptTarget = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 拒收弹窗：原因 + 现场处理人 -->
    <div v-if="declineTarget" class="modal-mask" @click.self="declineTarget = null">
      <div class="modal" style="width: 480px">
        <div class="modal-head">
          <h3>{{ DECLINE_REASON_META[declineReason].icon }} 拒收「{{ itemOf(declineTarget)?.name }}」</h3>
          <button class="modal-close" @click="declineTarget = null">✕</button>
        </div>
        <div class="notice warn mb12">
          <template v-if="declineReason === 'damaged'">
            拒收后物品将回到<b>家长确认流程</b>：家长可选择自行带回或进入环保回收，系统会记录现场处理人并同步异常处置台。
          </template>
          <template v-else>
            超过承接上限/年龄段不符的物品，页面将提示家长<b>带回、寄存到社区或预约下一场活动</b>，并同步异常处置台由社区跟进。
          </template>
        </div>
        <div v-if="declineReason === 'damaged'" class="field">
          <label>破损情况描述<span class="req">*</span></label>
          <textarea v-model.trim="damageDesc" class="textarea" placeholder="如：内页大面积撕毁、封面脱落……" />
        </div>
        <div v-else class="field">
          <label>拒收说明</label>
          <input v-model.trim="declineNote" class="input" :placeholder="elig(declineTarget).message || '如：3–6 岁档位名额已满'" />
        </div>
        <div class="field">
          <label>现场处理人<span class="req">*</span></label>
          <input v-model.trim="handler" class="input" placeholder="现场与家长交接的工作人员/志愿者" />
        </div>
        <div class="row">
          <button class="btn danger" @click="confirmDecline">确认拒收并通知家长</button>
          <button class="btn ghost" @click="declineTarget = null">取消</button>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import ItemCard from '../../components/ItemCard.vue'
import ItemPhoto from '../../components/ItemPhoto.vue'
import EmptyState from '../../components/EmptyState.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { DECLINE_REASON_META } from '../../meta'
import { fmtTime } from '../../utils'
import type { CharityQuota, Donation, DonationDeclineReason } from '../../types'

const auth = useAuthStore()
const data = useDataStore()

const me = computed(() => auth.currentUser!)

// ---------- 承接配置 ----------
const editing = ref(false)
const existing = computed(() => data.charityProfile(me.value.id))
const profile = computed(() => existing.value ?? {
  userId: me.value.id,
  quotas: [
    { label: '0–3 岁', ageRange: [0, 3], limit: 0 },
    { label: '3–6 岁', ageRange: [3, 6], limit: 5 },
    { label: '6–9 岁', ageRange: [6, 9], limit: 5 },
    { label: '9–12 岁', ageRange: [9, 12], limit: 0 },
  ] as CharityQuota[],
  transportTime: '活动结束后统一安排运输',
  transportMethod: '',
  invoiceSupported: false,
  invoiceNote: '',
  updatedAt: 0,
})

const form = reactive({
  quotas: [] as { label: string; ageRange0: number; ageRange1: number; limit: number }[],
  transportTime: '',
  transportMethod: '',
  invoiceSupported: false,
  invoiceNote: '',
})

function openConfig() {
  form.quotas = profile.value.quotas.map((q) => ({
    label: q.label, ageRange0: q.ageRange[0], ageRange1: q.ageRange[1], limit: q.limit,
  }))
  form.transportTime = profile.value.transportTime
  form.transportMethod = profile.value.transportMethod
  form.invoiceSupported = profile.value.invoiceSupported
  form.invoiceNote = profile.value.invoiceNote
  editing.value = true
}

function saveConfig() {
  if (form.quotas.some((q) => q.ageRange0 >= q.ageRange1 || q.ageRange0 < 0 || q.ageRange1 > 12)) {
    return alert('请检查年龄段：下限需小于上限，且在 0–12 岁之间')
  }
  if (!form.transportTime.trim()) return alert('请填写运输时间')
  data.saveCharityProfile(me.value.id, {
    quotas: form.quotas.map((q) => ({
      label: `${q.ageRange0}–${q.ageRange1} 岁`,
      ageRange: [q.ageRange0, q.ageRange1] as [number, number],
      limit: Math.max(0, Math.floor(q.limit || 0)),
    })),
    transportTime: form.transportTime.trim(),
    transportMethod: form.transportMethod.trim(),
    invoiceSupported: form.invoiceSupported,
    invoiceNote: form.invoiceNote.trim(),
  })
  editing.value = false
}

// ---------- 捐赠列表 ----------
const myDonations = computed(() => data.donations.filter((d) => d.charityId === me.value.id))
const requested = computed(() => myDonations.value.filter((d) => d.status === 'requested'))
const received = computed(() => myDonations.value.filter((d) => d.status === 'received'))
const declined = computed(() => myDonations.value.filter((d) => d.status === 'declined'))
const cap = computed(() => data.charityCapacityInfo(me.value.id))

function itemOf(d: Donation) {
  return data.itemById(d.itemId)
}
function parentOf(d: Donation) {
  const item = itemOf(d)
  return item ? data.userById(item.parentId)?.name : ''
}
function handoverOf(d: Donation) {
  return d.handoverId ? data.handovers.find((h) => h.id === d.handoverId) : undefined
}
function elig(d: Donation) {
  return data.checkEligibility(me.value.id, itemOf(d)!)
}
function usedOf(label: string) {
  return data.quotaUsed(me.value.id, label)
}
function pctUsed(label: string) {
  const q = profile.value.quotas.find((x) => x.label === label)
  if (!q || q.limit <= 0) return '0%'
  return `${Math.min(100, Math.round((usedOf(label) / q.limit) * 100))}%`
}

// ---------- 接收 + 交接清单 ----------
const acceptTarget = ref<Donation | null>(null)
const acceptError = ref('')
const acceptForm = reactive({
  handler: '',
  destination: '',
  transportTime: '',
  transportMethod: '',
  invoiceNeeded: false,
  invoiceTitle: '',
  photos: [] as string[],
})
const acceptElig = computed(() => (acceptTarget.value ? elig(acceptTarget.value) : { ok: false }))

function openAccept(d: Donation) {
  acceptTarget.value = d
  acceptError.value = ''
  acceptForm.handler = me.value.name
  acceptForm.destination = `${me.value.orgName ?? '公益机构'}物资中转站 → 帮扶家庭`
  acceptForm.transportTime = profile.value.transportTime
  acceptForm.transportMethod = profile.value.transportMethod
  acceptForm.invoiceNeeded = profile.value.invoiceSupported
  acceptForm.invoiceTitle = ''
  acceptForm.photos = []
}

function onHandoverPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 480 / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      acceptForm.photos.push(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

function confirmAccept() {
  if (!acceptTarget.value) return
  if (!acceptForm.handler.trim()) return (acceptError.value = '请填写现场经办人')
  if (!acceptForm.destination.trim()) return (acceptError.value = '请填写物品去向')
  if (!acceptForm.transportTime.trim()) return (acceptError.value = '请填写运输时间')
  const result = data.acceptDonation(acceptTarget.value.id, {
    handler: acceptForm.handler.trim(),
    destination: acceptForm.destination.trim(),
    transportTime: acceptForm.transportTime.trim(),
    transportMethod: acceptForm.transportMethod.trim() || undefined,
    invoiceNeeded: acceptForm.invoiceNeeded,
    invoiceTitle: acceptForm.invoiceTitle.trim() || undefined,
    photos: [...acceptForm.photos],
  })
  if (!result.ok) {
    acceptError.value = result.message ?? '该物品已超出承接上限，无法接收'
    return
  }
  acceptTarget.value = null
}

// ---------- 拒收 ----------
const declineTarget = ref<Donation | null>(null)
const declineReason = ref<DonationDeclineReason>('capacity')
const damageDesc = ref('')
const declineNote = ref('')
const handler = ref('')

function openDecline(d: Donation, reason: DonationDeclineReason) {
  declineTarget.value = d
  declineReason.value = reason
  damageDesc.value = ''
  declineNote.value = reason === 'capacity' && elig(d).reason === 'capacity' ? elig(d).message ?? '' : ''
  handler.value = ''
}

function confirmDecline() {
  if (!declineTarget.value) return
  if (declineReason.value === 'damaged' && !damageDesc.value.trim()) {
    return alert('请填写破损情况描述')
  }
  if (!handler.value.trim()) return alert('请填写现场处理人')
  data.declineDonation(
    declineTarget.value.id,
    declineReason.value,
    handler.value.trim(),
    {
      damageDesc: declineReason.value === 'damaged' ? damageDesc.value.trim() : undefined,
      note: declineReason.value === 'damaged' ? damageDesc.value.trim() : declineNote.value.trim() || undefined,
    },
  )
  declineTarget.value = null
}
</script>

<style scoped>
.quota-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.quota-box {
  border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: #fcf8f3;
}
.quota-box.full { border-color: #f0c78a; background: #fdf3e2; }
.quota-box.zero { opacity: 0.65; }
.q-age { font-weight: 700; font-size: 13px; }
.q-num { font-size: 12.5px; color: var(--ink-2); margin: 3px 0 6px; }
.q-bar { height: 6px; border-radius: 4px; background: #efe6db; overflow: hidden; }
.q-fill { height: 100%; background: var(--pink); border-radius: 4px; }
.quota-box.full .q-fill { background: var(--amber); }
.quota-edit-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; flex-wrap: wrap; }
.donation-block {
  border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin-top: 12px; background: #fff;
}
.donation-block .item-card { border: none; padding: 0; box-shadow: none; }
.elig-bar { margin: 8px 0; }
.handover-card { border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin-top: 10px; }
.handover-photos { display: flex; gap: 8px; margin-top: 8px; }
</style>
