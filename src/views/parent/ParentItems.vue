<template>
  <AppShell>
    <div class="row between mb16">
      <div>
        <h2 class="page-title">我的物品</h2>
        <p class="page-desc">从提交、审核、撮合、预约到核销、交换、捐赠去向的每一步都会在这里留下记录</p>
      </div>
      <router-link to="/parent/submit" class="btn primary">➕ 报名新物品</router-link>
    </div>

    <div v-if="myItems.length" class="grid cols-2">
      <ItemCard v-for="item in myItems" :key="item.id" :item="item">
        <template #actions>
          <button class="btn sm outline" @click="detail = item">📋 流转详情</button>
          <router-link v-if="item.status === 'approved'" to="/parent/matches" class="btn sm primary">去撮合</router-link>
          <router-link v-if="item.status === 'matched'" to="/parent/matches" class="btn sm primary">确认撮合</router-link>
          <button v-if="item.status === 'reserved'" class="btn sm primary" @click="pass = item">🎫 入场凭证</button>
          <button v-if="item.status === 'disputed'" class="btn sm danger" @click="$router.push('/parent/incidents')">🛟 查看争议</button>

          <!-- 无人交换：转捐 / 带回 -->
          <template v-if="item.status === 'no_exchange'">
            <button v-if="activeDonation(item.id)?.status === 'requested'" class="btn sm success" disabled>💚 已申请转捐，等待接收</button>
            <button v-else-if="item.acceptDonation" class="btn sm success" @click="donate(item)">💚 申请转捐</button>
            <template v-if="!capacityDecline(item)">
              <button class="btn sm outline" @click="chooseDisposal(item, 'take_back')">🎒 自行带回</button>
              <button class="btn sm outline" @click="chooseDisposal(item, 'store_community')">🏢 寄存社区</button>
              <button class="btn sm outline" @click="chooseDisposal(item, 'next_event')">🔁 预约下一场</button>
            </template>
          </template>

          <!-- 公益承接超上限后的提示与处置（仅在物品尚未选定去向时展示） -->
          <template v-if="item.status === 'no_exchange' && capacityDecline(item)">
            <div class="notice warn" style="width: 100%">
              <div>
                📦 公益机构本次无法接收：{{ declineText(capacityDecline(item)!) }}。请选择：自行带回、寄存到社区，或预约下一场活动（可在「争议协调」中与社区沟通）。
              </div>
            </div>
            <button class="btn sm outline" @click="chooseDisposal(item, 'take_back')">🎒 带回</button>
            <button class="btn sm outline" @click="chooseDisposal(item, 'store_community')">🏢 寄存社区</button>
            <button class="btn sm outline" @click="chooseDisposal(item, 'next_event')">🔁 约下一场</button>
            <button class="btn sm danger" @click="$router.push('/parent/incidents')">💬 联系社区</button>
          </template>

          <!-- 公益破损拒收：回到家长确认或环保回收 -->
          <template v-if="item.status === 'parent_confirm'">
            <div class="notice error" style="width: 100%">
              💔 公益机构现场复核认为物品破损不符合捐赠标准，已退回。请您确认：自行带回，或交由社区环保回收（将登记现场处理人）。
            </div>
            <button class="btn sm primary" @click="chooseDisposal(item, 'take_back')">🎒 确认带回</button>
            <button class="btn sm success" @click="chooseDisposal(item, 'recycle')">♻️ 同意环保回收</button>
            <button class="btn sm outline" @click="$router.push('/parent/incidents')">💬 与社区沟通</button>
          </template>

          <!-- 终态去向 -->
          <button v-if="item.status === 'donated'" class="btn sm success" @click="openHandover(item.id)">📋 查看捐赠交接清单</button>
          <template v-if="item.disposal && ['taken_back', 'stored_community', 'next_event', 'recycled'].includes(item.status)">
            <span class="tag" style="background: #eef4ff">
              {{ DISPOSAL_META[item.disposal.type].icon }} 现场处理人：{{ item.disposal.handler }}
            </span>
            <span v-if="item.disposal.channel" class="tag">{{ item.disposal.channel }}</span>
          </template>

          <span v-if="item.status === 'free_zone'" class="badge slate">可在自由交换区现场交换</span>
        </template>
      </ItemCard>
    </div>
    <div v-else class="card">
      <EmptyState icon="📦" text="还没有报名物品，点击右上角「报名新物品」开始吧">
        <router-link to="/parent/submit" class="btn primary mt12">➕ 报名新物品</router-link>
      </EmptyState>
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

    <!-- 终态去向确认弹窗 -->
    <div v-if="disposing" class="modal-mask" @click.self="disposing = null">
      <div class="modal" style="width: 460px">
        <div class="modal-head">
          <h3>{{ DISPOSAL_META[disposalType!].icon }} 确认「{{ DISPOSAL_META[disposalType!].label }}」</h3>
          <button class="modal-close" @click="disposing = null">✕</button>
        </div>
        <p class="small muted mb12">
          物品「{{ disposing.name }}」（{{ disposing.code }}）将标记为<b>「{{ statusLabel(disposalType!) }}」</b>，请确认信息以便社区登记。
        </p>
        <div class="field">
          <label>现场处理人<span class="req">*</span></label>
          <input v-model.trim="disposalForm.handler" class="input" placeholder="默认为您本人" />
        </div>
        <div v-if="disposalType === 'store_community'" class="field">
          <label>寄存位置</label>
          <input v-model.trim="disposalForm.channel" class="input" placeholder="如：社区服务中心储物架 A2" />
        </div>
        <div v-if="disposalType === 'recycle'" class="field">
          <label>回收渠道</label>
          <input v-model.trim="disposalForm.channel" class="input" placeholder="如：社区再生资源织物回收箱" />
        </div>
        <div v-if="disposalType === 'next_event'" class="field">
          <label>下一场安排</label>
          <input v-model.trim="disposalForm.channel" class="input" placeholder="如：已预约下一场（10 月 25 日）交换名额" />
        </div>
        <div class="field">
          <label>备注说明</label>
          <textarea v-model.trim="disposalForm.note" class="textarea" placeholder="可留空" />
        </div>
        <div class="row">
          <button class="btn primary" @click="confirmDisposal">确认</button>
          <button class="btn ghost" @click="disposing = null">取消</button>
        </div>
      </div>
    </div>

    <ItemDetailModal :item="detail" @close="detail = null" />
    <HandoverSheet v-if="handover" :ho="handover" @close="handover = null" />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import ItemCard from '../../components/ItemCard.vue'
import ItemDetailModal from '../../components/ItemDetailModal.vue'
import EmptyState from '../../components/EmptyState.vue'
import QrCode from '../../components/QrCode.vue'
import HandoverSheet from '../../components/HandoverSheet.vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { DISPOSAL_META, STATUS_META } from '../../meta'
import type { DisposalType, Donation, Handover, Item } from '../../types'

const auth = useAuthStore()
const data = useDataStore()

const detail = ref<Item | null>(null)
const pass = ref<Item | null>(null)
const handover = ref<Handover | null>(null)

const myItems = computed(() => data.itemsByParent(auth.currentUser?.id ?? ''))

function activeDonation(itemId: string): Donation | undefined {
  return data.donations.find((d) => d.itemId === itemId && d.status !== 'declined')
}

/** 公益因超上限 / 年龄段等原因（非破损）的最近一次拒收记录 */
function capacityDecline(item: Item): Donation | undefined {
  return data.donations
    .filter((d) => d.itemId === item.id && d.status === 'declined' && d.declineReason !== 'damaged')
    .sort((a, b) => (b.respondedAt ?? b.createdAt) - (a.respondedAt ?? a.createdAt))[0]
}
function declineText(d: Donation): string {
  return d.note || '本场承接名额已满'
}

function donate(item: Item) {
  data.requestDonation(item.id, auth.currentUser!.name)
}

// ---------- 终态去向 ----------
const disposing = ref<Item | null>(null)
const disposalType = ref<DisposalType | null>(null)
const disposalForm = reactive({ handler: '', channel: '', note: '' })

function statusLabel(t: DisposalType) {
  return STATUS_META[DISPOSAL_META[t].status].label
}

function chooseDisposal(item: Item, type: DisposalType) {
  disposing.value = item
  disposalType.value = type
  disposalForm.handler = auth.currentUser!.name
  disposalForm.channel = ''
  disposalForm.note = ''
}

function confirmDisposal() {
  if (!disposing.value || !disposalType.value) return
  if (!disposalForm.handler.trim()) {
    alert('请填写现场处理人')
    return
  }
  data.disposeItem(disposing.value.id, disposalType.value, {
    handler: disposalForm.handler.trim(),
    handlerRole: 'parent',
    channel: disposalForm.channel.trim() || undefined,
    note: disposalForm.note.trim() || undefined,
  })
  disposing.value = null
}

function openHandover(itemId: string) {
  const ho = data.handoverByItem(itemId)
  if (ho) handover.value = ho
}
</script>
