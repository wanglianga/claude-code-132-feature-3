<template>
  <AppShell>
    <div class="row between mb16">
      <div>
        <h2 class="page-title">我的物品</h2>
        <p class="page-desc">从提交、审核、撮合、预约到核销、交换的每一步都会在这里留下记录</p>
      </div>
      <router-link to="/parent/submit" class="btn primary">➕ 报名新物品</router-link>
    </div>

    <div v-if="myItems.length" class="grid cols-2">
      <div v-for="item in myItems" :key="item.id" class="item-cell">
      <ItemCard :item="item">
        <template #actions>
          <button class="btn sm outline" @click="detail = item">📋 流转详情</button>
          <router-link v-if="item.status === 'approved'" to="/parent/matches" class="btn sm primary">去撮合</router-link>
          <router-link v-if="item.status === 'matched'" to="/parent/matches" class="btn sm primary">确认撮合</router-link>
          <button v-if="item.status === 'reserved'" class="btn sm primary" @click="pass = item">🎫 入场凭证</button>
          <button v-if="item.status === 'disputed'" class="btn sm danger" @click="$router.push('/parent/incidents')">🛟 查看争议</button>
          <template v-if="item.status === 'no_exchange'">
            <button v-if="item.acceptDonation && !hasDonation(item.id)" class="btn sm success" @click="donate(item)">💚 申请转捐</button>
            <span v-if="donationActive(item.id)" class="badge pink">已申请转捐，等待接收</span>
            <button class="btn sm outline" @click="takeBack(item)">🎒 自行带回</button>
          </template>
          <span v-if="item.status === 'free_zone'" class="badge slate">可在自由交换区现场交换</span>

          <!-- 公益拒收 / 超过承接上限：家长确认去向 -->
          <template v-if="item.status === 'charity_returned'">
            <button class="btn sm primary" @click="openDispose(item)">👉 确认物品去向</button>
            <button class="btn sm outline" @click="openDispose(item, 'take_back')">🎒 自行带回</button>
          </template>
          <template v-if="item.status === 'stored'">
            <span class="badge indigo">🏢 已寄存社区{{ item.disposal?.note ? `：${item.disposal.note}` : '' }}</span>
          </template>
          <template v-if="item.status === 'next_event'">
            <span class="badge purple">🔁 已预约下一场活动{{ item.disposal?.nextEvent ? `（${item.disposal.nextEvent}）` : '' }}</span>
          </template>
          <template v-if="item.status === 'recycled'">
            <span class="badge teal">♻️ 已环保回收{{ item.disposal?.recycler ? `（${item.disposal.recycler}）` : '' }}</span>
          </template>
          <!-- 已捐赠：查看交接清单与去向 -->
          <button v-if="item.status === 'donated' && handover(item.id)" class="btn sm success" @click="openHandover(item)">
            📋 查看交接清单与去向
          </button>
        </template>
      </ItemCard>

      <!-- 拒收原因提示条 -->
      <div v-if="item.status === 'charity_returned'" class="card dispose-notice">
        <template v-if="declineOf(item.id)?.declineReason === 'damaged'">
          <div class="notice error" style="margin: 0">
            🧩 公益机构因物品破损拒收：{{ declineOf(item.id)?.damageDesc || declineOf(item.id)?.note }}
            （现场处理人：{{ declineOf(item.id)?.handler || '—' }}）。请您选择<b>自行带回</b>或进入<b>环保回收</b>流程。
          </div>
        </template>
        <template v-else-if="declineOf(item.id)?.declineReason === 'age_unfit'">
          <div class="notice warn" style="margin: 0">
            🔢 该物品年龄段不在公益机构本场可接收范围{{ declineOf(item.id)?.note ? `：${declineOf(item.id)?.note}` : '' }}
            （现场处理人：{{ declineOf(item.id)?.handler || '—' }}）。您可以选择<b>带回、寄存到社区或预约下一场活动</b>。
          </div>
        </template>
        <template v-else>
          <div class="notice warn" style="margin: 0">
            📦 该物品已超过公益机构本场承接上限：{{ declineOf(item.id)?.note }}
            （现场处理人：{{ declineOf(item.id)?.handler || '—' }}）。您可以选择<b>带回、寄存到社区或预约下一场活动</b>。
          </div>
        </template>
      </div>
      </div>
    </div>
    <div v-else class="card">
      <EmptyState icon="📦" text="还没有报名物品，点击右上角「报名新物品」开始吧">
        <router-link to="/parent/submit" class="btn primary mt12">➕ 报名新物品</router-link>
      </EmptyState>
    </div>

    <!-- 公益拒收 / 超限：家长确认去向 -->
    <div v-if="disposeItem" class="modal-mask" @click.self="disposeItem = null">
      <div class="modal" style="width: 520px">
        <div class="modal-head">
          <h3>👉 确认「{{ disposeItem.name }}」的去向</h3>
          <button class="modal-close" @click="disposeItem = null">✕</button>
        </div>

        <div v-if="isDamagedDecline(disposeItem.id)" class="notice error mb12">
          🧩 公益机构因破损拒收：{{ declineOf(disposeItem.id)?.damageDesc || declineOf(disposeItem.id)?.note }}
          （现场处理人：{{ declineOf(disposeItem.id)?.handler || '—' }}）
        </div>
        <div v-else class="notice warn mb12">
          📦 该物品已超过公益机构本场承接上限（{{ declineOf(disposeItem.id)?.note }}，
          现场处理人：{{ declineOf(disposeItem.id)?.handler || '—' }}），请选择处理方式
        </div>

        <div class="dispose-options">
          <button
            class="dispose-opt"
            :class="{ on: disposeRoute === 'take_back' }"
            @click="disposeRoute = 'take_back'"
          >
            <div class="do-icon">🎒</div>
            <div class="do-title">家长带回</div>
            <div class="do-desc">活动结束后自行带回，继续保留物品</div>
          </button>
          <button
            v-if="!isDamagedDecline(disposeItem.id)"
            class="dispose-opt"
            :class="{ on: disposeRoute === 'community_store' }"
            @click="disposeRoute = 'community_store'"
          >
            <div class="do-icon">🏢</div>
            <div class="do-title">寄存到社区</div>
            <div class="do-desc">暂存社区服务站，7 天内可凭码取回</div>
          </button>
          <button
            v-if="!isDamagedDecline(disposeItem.id)"
            class="dispose-opt"
            :class="{ on: disposeRoute === 'next_event' }"
            @click="disposeRoute = 'next_event'"
          >
            <div class="do-icon">🔁</div>
            <div class="do-title">预约下一场活动</div>
            <div class="do-desc">登记进入下一场优先撮合名单</div>
          </button>
          <button
            v-if="isDamagedDecline(disposeItem.id)"
            class="dispose-opt"
            :class="{ on: disposeRoute === 'recycle' }"
            @click="disposeRoute = 'recycle'"
          >
            <div class="do-icon">♻️</div>
            <div class="do-title">环保回收</div>
            <div class="do-desc">现场分类后送往再生资源回收点</div>
          </button>
        </div>

        <div v-if="disposeRoute === 'community_store'" class="field mt12">
          <label>寄存地点 / 柜号</label>
          <input v-model.trim="disposeNote" class="input" placeholder="如：社区服务站储物间 A-03 柜" />
        </div>
        <div v-if="disposeRoute === 'next_event'" class="field mt12">
          <label>下一场活动</label>
          <input v-model.trim="nextEventText" class="input" placeholder="如：第四届亲子旧物交换日（暂定 2026-11-15）" />
        </div>
        <div v-if="disposeRoute === 'recycle'" class="field mt12">
          <label>回收单位</label>
          <input v-model.trim="recyclerText" class="input" placeholder="如：绿芽再生资源回收点" />
        </div>

        <div class="field mt12">
          <label>现场处理人<span class="req">*</span></label>
          <input v-model.trim="disposeHandler" class="input" placeholder="现场与您交接的工作人员/志愿者" />
        </div>

        <div class="row">
          <button class="btn primary" @click="confirmDispose">确认去向</button>
          <button class="btn ghost" @click="disposeItem = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 已捐赠：交接清单与去向 -->
    <div v-if="handoverItem" class="modal-mask" @click.self="handoverItem = null">
      <div class="modal" style="width: 520px">
        <div class="modal-head">
          <h3>📋 捐赠交接清单 · {{ handoverItem.name }}</h3>
          <button class="modal-close" @click="handoverItem = null">✕</button>
        </div>
        <div v-if="hv" class="handover-detail">
          <span class="badge pink">清单编号 {{ hv.id.replace('hv', 'HV').toUpperCase() }}</span>
          <div class="handover-photos mt12">
            <ItemPhoto v-for="(p, i) in hv.photos" :key="i" :photo="p" :category="handoverItem.category" lg />
          </div>
          <table class="table mt12">
            <tbody>
              <tr><th>接收机构</th><td>{{ data.userById(hv.charityId)?.orgName }}</td></tr>
              <tr><th>现场经办人</th><td>{{ hv.handler }}</td></tr>
              <tr><th>物品去向</th><td>{{ hv.destination }}</td></tr>
              <tr><th>运输时间</th><td>{{ hv.transportTime }}</td></tr>
              <tr v-if="hv.transportMethod"><th>运输方式</th><td>{{ hv.transportMethod }}</td></tr>
              <tr><th>开票需求</th><td>{{ hv.invoiceNeeded ? `已登记开票${hv.invoiceTitle ? `，抬头：${hv.invoiceTitle}` : ''}` : '无需开票' }}</td></tr>
              <tr><th>交接时间</th><td>{{ fmtTime(hv.at) }}</td></tr>
            </tbody>
          </table>
          <div class="notice success mt12">💚 感谢您的捐赠，物品去向可随时在此页面查看。</div>
        </div>
      </div>
    </div>

    <!-- 入场凭证 -->
    <div v-if="pass" class="modal-mask" @click.self="pass = null">
      <div class="modal" style="width: 420px; text-align: center">
        <div class="modal-head">
          <h3>🎫 入场凭证</h3>
          <button class="modal-close" @click="pass = null">✕</button>
        </div>
        <p style="font-weight: 700; font-size: 16px">{{ pass.name }}</p>
        <p class="muted small mb12">请向现场志愿者出示此码完成核销</p>
        <QrCode :code="pass.code" />
        <div class="grid cols-2 mt16" style="text-align: left">
          <div class="card" style="padding: 12px; box-shadow: none">
            <div class="small muted">入场时段</div>
            <div style="font-weight: 700">🕐 {{ pass.entryTime }}</div>
          </div>
          <div class="card" style="padding: 12px; box-shadow: none">
            <div class="small muted">交换摊位</div>
            <div style="font-weight: 700">📍 {{ pass.booth }}</div>
          </div>
        </div>
        <div class="notice info mt16" style="text-align: left">
          温馨提示：请确保携带物品与报名照片一致、提前完成消毒；如无法到场请提前联系社区工作人员。
        </div>
      </div>
    </div>

    <ItemDetailModal :item="detail" @close="detail = null" />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import ItemCard from '../../components/ItemCard.vue'
import ItemDetailModal from '../../components/ItemDetailModal.vue'
import ItemPhoto from '../../components/ItemPhoto.vue'
import EmptyState from '../../components/EmptyState.vue'
import QrCode from '../../components/QrCode.vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { fmtTime } from '../../utils'
import type { DisposalRoute, Item } from '../../types'

const auth = useAuthStore()
const data = useDataStore()

const detail = ref<Item | null>(null)
const pass = ref<Item | null>(null)

const myItems = computed(() => data.itemsByParent(auth.currentUser?.id ?? ''))

function donationOf(itemId: string) {
  return data.donations.find((d) => d.itemId === itemId)
}
function hasDonation(itemId: string) {
  return data.donations.some((d) => d.itemId === itemId && d.status !== 'declined')
}
function donationActive(itemId: string) {
  const d = donationOf(itemId)
  return d?.status === 'requested' || d?.status === 'received'
}
function declineOf(itemId: string) {
  const d = donationOf(itemId)
  return d?.status === 'declined' ? d : undefined
}
function isDamagedDecline(itemId: string) {
  return declineOf(itemId)?.declineReason === 'damaged'
}
function handover(itemId: string) {
  return data.handoverByItem(itemId)
}

function donate(item: Item) {
  data.requestDonation(item.id, auth.currentUser!.name)
}

function takeBack(item: Item) {
  if (confirm(`确认将「${item.name}」自行带回吗？`)) {
    data.takeBack(item.id, auth.currentUser!.name)
  }
}

// ---------- 拒收/超限物品去向确认 ----------
const disposeItem = ref<Item | null>(null)
const disposeRoute = ref<DisposalRoute>('take_back')
const disposeNote = ref('')
const nextEventText = ref('')
const recyclerText = ref('绿芽再生资源回收点')
const disposeHandler = ref('')

function openDispose(item: Item, preset?: DisposalRoute) {
  disposeItem.value = item
  disposeRoute.value = preset ?? (isDamagedDecline(item.id) ? 'take_back' : 'take_back')
  disposeNote.value = ''
  nextEventText.value = '第四届亲子旧物交换日（暂定 2026-11-15）'
  recyclerText.value = '绿芽再生资源回收点'
  disposeHandler.value = declineOf(item.id)?.handler ?? ''
  if (preset) confirmDispose()
}

function confirmDispose() {
  if (!disposeItem.value) return
  if (!disposeHandler.value.trim()) return alert('请填写现场处理人')
  if (disposeRoute.value === 'next_event' && !nextEventText.value.trim()) return alert('请填写下一场活动信息')
  if (disposeRoute.value === 'recycle' && !recyclerText.value.trim()) return alert('请填写回收单位')
  data.disposeReturnedItem(disposeItem.value.id, disposeRoute.value, {
    actor: auth.currentUser!.name,
    handler: disposeHandler.value.trim(),
    note: disposeRoute.value === 'community_store'
      ? disposeNote.value.trim() || '寄存社区服务站，7 天内可凭码取回'
      : undefined,
    nextEvent: disposeRoute.value === 'next_event' ? nextEventText.value.trim() : undefined,
    recycler: disposeRoute.value === 'recycle' ? recyclerText.value.trim() : undefined,
  })
  disposeItem.value = null
}

// ---------- 交接清单查看 ----------
const handoverItem = ref<Item | null>(null)
const hv = computed(() => (handoverItem.value ? data.handoverByItem(handoverItem.value.id) : undefined))
function openHandover(item: Item) {
  handoverItem.value = item
}
</script>

<style scoped>
.item-cell { display: flex; flex-direction: column; gap: 10px; }
.item-cell .item-card { margin: 0; }
.dispose-notice { padding: 10px 12px; }
.dispose-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.dispose-opt {
  text-align: left; border: 1.5px solid var(--line); border-radius: 12px; padding: 12px;
  background: #fff; cursor: pointer; transition: all 0.15s;
}
.dispose-opt:hover { border-color: var(--primary); }
.dispose-opt.on { border-color: var(--primary); background: #fdf4ec; }
.do-icon { font-size: 24px; }
.do-title { font-weight: 700; margin: 4px 0 2px; }
.do-desc { font-size: 12px; color: var(--ink-2); }
.handover-photos { display: flex; gap: 10px; flex-wrap: wrap; }
</style>
