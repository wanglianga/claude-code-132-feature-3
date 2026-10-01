<template>
  <AppShell>
    <h2 class="page-title">捐赠接收</h2>
    <p class="page-desc">
      活动结束时在此标记本场可接收年龄段、承接数量、运输时间与开票需求；
      超过承接上限的物品由家长选择带回、寄存社区或预约下一场；破损物品退回家长确认或环保回收
    </p>

    <!-- 承接能力 -->
    <div class="grid cols-4">
      <div class="card stat-card">
        <div class="num">{{ profile?.capacityLimit ?? '—' }}</div>
        <div class="lbl">本场承接上限（件）</div>
      </div>
      <div class="card stat-card">
        <div class="num" style="color: var(--pink)">{{ received.length }}</div>
        <div class="lbl">已接收 / 占用名额</div>
      </div>
      <div class="card stat-card">
        <div class="num" :style="{ color: remaining === 0 ? 'var(--red)' : 'var(--green)' }">{{ remaining === Infinity ? '不限' : remaining }}</div>
        <div class="lbl">剩余承接名额</div>
      </div>
      <div class="card stat-card">
        <div class="num" style="color: var(--amber)">{{ requested.length }}</div>
        <div class="lbl">待处理申请</div>
      </div>
    </div>

    <!-- 承接设置 -->
    <div class="card mt16">
      <div class="row between wrap">
        <div class="card-title" style="margin: 0">🎯 本场承接设置</div>
        <button v-if="!editing" class="btn sm outline" @click="startEdit">✏️ {{ profile ? '修改设置' : '标记承接信息' }}</button>
      </div>

      <div v-if="!editing && profile" class="mt12">
        <div class="tag-list">
          <span class="tag">👶 可接收年龄段：{{ profile.acceptAgeRange[0] }}–{{ profile.acceptAgeRange[1] }} 岁</span>
          <span class="tag">📦 承接上限：{{ profile.capacityLimit }} 件</span>
          <span class="tag">🚚 {{ profile.pickupWindow }}</span>
          <span :class="profile.invoiceNeeded ? 'badge green' : 'badge gray'">
            {{ profile.invoiceNeeded ? '🧾 需要开票' : '无需开票' }}
          </span>
        </div>
        <p v-if="profile.invoiceNote" class="small muted mt8">开票信息：{{ profile.invoiceNote }}</p>
        <p class="small muted mt8">更新于 {{ fmtTime(profile.updatedAt) }}（修改上限不会释放已占用名额）</p>
      </div>
      <EmptyState v-else-if="!editing" icon="🎯" text="尚未标记本场承接信息，请先设置可接收年龄段、数量、运输时间与开票需求" />

      <div v-else class="mt16">
        <div class="field">
          <label>可接收年龄段（岁）<span class="req">*</span></label>
          <div class="row">
            <input v-model.number="form.ageMin" type="number" min="0" max="12" class="input" style="max-width: 90px" />
            <span>至</span>
            <input v-model.number="form.ageMax" type="number" min="0" max="12" class="input" style="max-width: 90px" />
            <span class="small muted">仅接收年龄段有交集的物品，范围外的申请会提示家长改选其他去向</span>
          </div>
        </div>
        <div class="field">
          <label>本场承接上限（件）<span class="req">*</span></label>
          <input v-model.number="form.capacityLimit" type="number" min="1" max="999" class="input" style="max-width: 160px" />
        </div>
        <div class="field">
          <label>运输 / 上门取件时间<span class="req">*</span></label>
          <input v-model.trim="form.pickupWindow" class="input" placeholder="如：活动结束后 3 天内每日 9:00–17:00 上门取件" />
        </div>
        <div class="field">
          <label class="check-line">
            <input v-model="form.invoiceNeeded" type="checkbox" />
            需要为捐赠家长开具公益事业捐赠票据
          </label>
        </div>
        <div v-if="form.invoiceNeeded" class="field">
          <label>开票抬头 / 税号等信息</label>
          <textarea v-model.trim="form.invoiceNote" class="textarea" placeholder="如：抬头「春芽公益发展中心」，税号……" />
        </div>
        <div v-if="editError" class="notice error mb12">{{ editError }}</div>
        <div class="row">
          <button class="btn primary" @click="saveProfile">💾 保存承接设置</button>
          <button class="btn ghost" @click="editing = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 待处理申请 -->
    <div class="card mt16">
      <div class="card-title">📥 待处理捐赠申请（{{ requested.length }}）</div>
      <template v-if="requested.length">
        <div v-for="d in requested" :key="d.id" class="donation-row">
          <ItemCard :item="itemOf(d)!" show-owner>
            <template #actions>
              <button class="btn sm success" :disabled="!elig(d)?.ok" @click="openReceive(d)">✅ 确认接收并生成交接清单</button>
              <button class="btn sm danger" @click="openDecline(d)">🚫 拒收</button>
            </template>
          </ItemCard>
          <div v-for="(w, i) in elig(d)?.warnings ?? []" :key="'w' + i" class="notice warn" style="margin: 0 0 8px">⚠️ {{ w }}</div>
          <div v-if="elig(d) && !elig(d)!.ok">
            <div v-for="(b, i) in elig(d)!.blocks" :key="'b' + i" class="notice error" style="margin: 0 0 8px">
              ❌ {{ b }} —— 请拒收并通知家长：带回 / 寄存社区 / 预约下一场
            </div>
          </div>
        </div>
      </template>
      <EmptyState v-else icon="📥" text="暂无待处理的捐赠申请" />
    </div>

    <!-- 已接收 -->
    <div class="card">
      <div class="card-title">💚 已接收物品（{{ received.length }}）</div>
      <table v-if="received.length" class="table">
        <thead>
          <tr><th>交接单号</th><th>物品</th><th>捐赠家长</th><th>品类</th><th>运输时间</th><th>开票</th><th>去向</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in received" :key="d.id">
            <td><b>{{ handoverOf(d)?.code ?? '—' }}</b></td>
            <td>{{ itemOf(d)?.name }}</td>
            <td>{{ parentOf(d) }}</td>
            <td>{{ itemOf(d) ? CATEGORY_META[itemOf(d)!.category].label : '' }}</td>
            <td class="small muted">{{ handoverOf(d)?.pickupWindow ?? '—' }}</td>
            <td>
              <span :class="handoverOf(d)?.invoiceNeeded ? 'badge green' : 'badge gray'">
                {{ handoverOf(d)?.invoiceNeeded ? '需开票' : '无需' }}
              </span>
            </td>
            <td class="small muted">{{ d.note ?? '统一消杀后送往帮扶家庭' }}</td>
            <td>
              <button v-if="handoverOf(d)" class="btn sm outline" @click="viewHandover = handoverOf(d)!">📋 交接清单</button>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else icon="💚" text="暂无接收记录" />
    </div>

    <!-- 已拒收 -->
    <div class="card">
      <div class="card-title">🚫 已拒收（{{ declined.length }}）</div>
      <table v-if="declined.length" class="table">
        <thead><tr><th>物品</th><th>家长</th><th>拒收原因</th><th>当前去向</th></tr></thead>
        <tbody>
          <tr v-for="d in declined" :key="d.id">
            <td>{{ itemOf(d)?.name }}</td>
            <td>{{ parentOf(d) }}</td>
            <td class="small muted">
              {{ d.declineReason ? DECLINE_REASON_META[d.declineReason].label : '接收能力不足' }}
              <span v-if="d.note">：{{ d.note }}</span>
            </td>
            <td><StatusBadge v-if="itemOf(d)" :status="itemOf(d)!.status" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else icon="🚫" text="暂无拒收记录" />
    </div>

    <!-- 接收弹窗：生成交接清单 -->
    <div v-if="receiving" class="modal-mask" @click.self="receiving = null">
      <div class="modal" style="width: 560px">
        <div class="modal-head">
          <h3>✅ 现场清点接收「{{ itemOf(receiving)?.name }}」</h3>
          <button class="modal-close" @click="receiving = null">✕</button>
        </div>
        <p class="small muted mb12">确认接收将占用 1 个承接名额并生成交接清单（含清点明细、照片、运输时间与开票需求），家长可随时查看去向。</p>

        <div class="field">
          <label>公益机构现场处理人<span class="req">*</span></label>
          <input v-model.trim="recv.charityHandler" class="input" placeholder="默认为当前登录人" />
        </div>
        <div class="field">
          <label>社区监交人</label>
          <input v-model.trim="recv.staffHandler" class="input" placeholder="如：王芳（可留空）" />
        </div>
        <div class="field">
          <label>捐赠去向</label>
          <input v-model.trim="recv.destination" class="input" placeholder="如：统一消杀后送往山区幼儿园" />
        </div>
        <div class="field">
          <label>现场交接照片（可选，最多 3 张）</label>
          <div class="row wrap">
            <div v-for="(p, i) in recv.photos" :key="i" style="position: relative">
              <ItemPhoto :photo="p" category="toy" lg />
              <button
                type="button"
                class="modal-close"
                style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; font-size: 10px"
                @click="recv.photos.splice(i, 1)"
              >✕</button>
            </div>
            <label v-if="recv.photos.length < 3" class="item-photo" style="cursor: pointer; font-size: 24px; color: var(--ink-3)">
              ＋
              <input type="file" accept="image/*" style="display: none" @change="onPhoto" />
            </label>
          </div>
          <p class="hint">不上传时使用物品报名照片作为交接照片</p>
        </div>
        <div class="notice info">
          🚚 运输时间：{{ profile?.pickupWindow }}　·　🧾 {{ profile?.invoiceNeeded ? `需开票：${profile?.invoiceNote || '公益事业捐赠票据'}` : '无需开票' }}
        </div>
        <div v-if="recvError" class="notice error mt12">{{ recvError }}</div>
        <div class="row mt12">
          <button class="btn success" @click="confirmReceive">✅ 确认接收，生成交接清单</button>
          <button class="btn ghost" @click="receiving = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 拒收弹窗 -->
    <div v-if="declining" class="modal-mask" @click.self="declining = null">
      <div class="modal" style="width: 480px">
        <div class="modal-head">
          <h3>🚫 拒收「{{ itemOf(declining)?.name }}」</h3>
          <button class="modal-close" @click="declining = null">✕</button>
        </div>
        <div class="field">
          <label>拒收原因<span class="req">*</span></label>
          <div class="chip-row">
            <button
              v-for="(meta, key) in DECLINE_REASON_META"
              :key="key"
              type="button"
              class="chip"
              :class="{ on: decl.reason === key, warn: key === 'damaged' && decl.reason === key }"
              @click="decl.reason = key as DonationDeclineReason"
            >
              {{ meta.icon }} {{ meta.label }}
            </button>
          </div>
        </div>
        <div class="field">
          <label>情况说明</label>
          <textarea v-model.trim="decl.note" class="textarea" :placeholder="decl.reason === 'damaged' ? '请描述破损情况，如：书角卷边、有明显水渍……' : '向家长与社区说明情况……'" />
        </div>
        <div :class="decl.reason === 'damaged' ? 'notice warn' : 'notice info'">
          {{ decl.reason === 'damaged'
            ? '破损拒收后物品将退回家长，由家长确认「自行带回」或「环保回收」，并生成异常单要求登记现场处理人。'
            : '拒收后系统将生成「公益承接超上限」异常单，提示家长选择带回、寄存社区或预约下一场活动。' }}
        </div>
        <div class="row mt12">
          <button class="btn danger" @click="confirmDecline">确认拒收</button>
          <button class="btn ghost" @click="declining = null">取消</button>
        </div>
      </div>
    </div>

    <HandoverSheet v-if="viewHandover" :ho="viewHandover" @close="viewHandover = null" />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import ItemCard from '../../components/ItemCard.vue'
import ItemPhoto from '../../components/ItemPhoto.vue'
import EmptyState from '../../components/EmptyState.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import HandoverSheet from '../../components/HandoverSheet.vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { CATEGORY_META, DECLINE_REASON_META } from '../../meta'
import { fmtTime } from '../../utils'
import type { Donation, DonationDeclineReason, Handover } from '../../types'

const auth = useAuthStore()
const data = useDataStore()

const me = computed(() => auth.currentUser!)
const profile = computed(() => data.charityProfile(me.value.id))

const myDonations = computed(() => data.donations.filter((d) => d.charityId === me.value.id))
const requested = computed(() => myDonations.value.filter((d) => d.status === 'requested'))
const received = computed(() => myDonations.value.filter((d) => d.status === 'received'))
const declined = computed(() => myDonations.value.filter((d) => d.status === 'declined'))
const remaining = computed(() => data.charityRemaining(me.value.id))

function itemOf(d: Donation) {
  return data.itemById(d.itemId)
}
function parentOf(d: Donation) {
  const item = itemOf(d)
  return item ? data.userById(item.parentId)?.name : ''
}
function handoverOf(d: Donation): Handover | undefined {
  return d.handoverId ? data.handoverById(d.handoverId) : undefined
}
function elig(d: Donation) {
  return data.evaluateDonation(d.id)
}

// ---------- 承接设置 ----------
const editing = ref(false)
const editError = ref('')
const form = reactive({
  ageMin: 3,
  ageMax: 9,
  capacityLimit: 3,
  pickupWindow: '',
  invoiceNeeded: true,
  invoiceNote: '',
})

function startEdit() {
  const p = profile.value
  form.ageMin = p?.acceptAgeRange[0] ?? 3
  form.ageMax = p?.acceptAgeRange[1] ?? 9
  form.capacityLimit = p?.capacityLimit ?? 3
  form.pickupWindow = p?.pickupWindow ?? ''
  form.invoiceNeeded = p?.invoiceNeeded ?? false
  form.invoiceNote = p?.invoiceNote ?? ''
  editing.value = true
}

function saveProfile() {
  editError.value = ''
  if (form.ageMin < 0 || form.ageMax > 12 || form.ageMin >= form.ageMax) {
    editError.value = '请填写正确的可接收年龄段（最小年龄需小于最大年龄，0–12 岁）'
    return
  }
  if (!form.capacityLimit || form.capacityLimit < 1) {
    editError.value = '请填写本场承接上限（至少 1 件）'
    return
  }
  if (!form.pickupWindow.trim()) {
    editError.value = '请填写运输 / 上门取件时间'
    return
  }
  data.saveCharityProfile(me.value.id, {
    acceptAgeRange: [Number(form.ageMin), Number(form.ageMax)],
    capacityLimit: Number(form.capacityLimit),
    pickupWindow: form.pickupWindow.trim(),
    invoiceNeeded: form.invoiceNeeded,
    invoiceNote: form.invoiceNeeded ? form.invoiceNote.trim() || undefined : undefined,
  })
  editing.value = false
}

// ---------- 接收 / 交接清单 ----------
const receiving = ref<Donation | null>(null)
const recvError = ref('')
const recv = reactive({ charityHandler: '', staffHandler: '', destination: '', photos: [] as string[] })
const viewHandover = ref<Handover | null>(null)

function openReceive(d: Donation) {
  receiving.value = d
  recv.charityHandler = me.value.name
  recv.staffHandler = data.users.find((u) => u.role === 'staff')?.name ?? ''
  recv.destination = ''
  recv.photos = []
  recvError.value = ''
}

function onPhoto(e: Event) {
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
      recv.photos.push(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

function confirmReceive() {
  if (!receiving.value) return
  if (!recv.charityHandler.trim()) {
    recvError.value = '请填写公益机构现场处理人'
    return
  }
  const ho = data.receiveDonation(receiving.value.id, me.value.name, {
    charityHandler: recv.charityHandler.trim(),
    staffHandler: recv.staffHandler.trim() || undefined,
    destination: recv.destination.trim() || undefined,
    extraPhotos: recv.photos,
  })
  if (!ho) {
    recvError.value = '接收失败：该物品不符合当前承接条件（名额已满或年龄段不符），请拒收'
    return
  }
  receiving.value = null
  viewHandover.value = ho
}

// ---------- 拒收 ----------
const declining = ref<Donation | null>(null)
const decl = reactive({ reason: 'over_capacity' as DonationDeclineReason, note: '' })

function openDecline(d: Donation) {
  declining.value = d
  const e = data.evaluateDonation(d.id)
  decl.reason = !e?.capacityOk ? 'over_capacity' : !e?.ageOk ? 'age_unfit' : e?.damaged ? 'damaged' : 'over_capacity'
  decl.note = ''
}

function confirmDecline() {
  if (!declining.value) return
  if (!decl.note.trim() && decl.reason === 'other') {
    alert('请填写拒收情况说明')
    return
  }
  data.declineDonation(
    declining.value.id,
    decl.reason,
    decl.note.trim() || (decl.reason === 'damaged' ? '物品破损，不符合捐赠标准' : ''),
    me.value.name,
  )
  declining.value = null
}
</script>

<style scoped>
.donation-row { margin-bottom: 4px; }
</style>
