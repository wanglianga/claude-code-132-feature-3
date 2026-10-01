<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal" style="width: 680px">
      <div class="modal-head">
        <h3>📋 公益捐赠交接清单 <span class="badge pink">{{ ho.code }}</span></h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div class="row between wrap mb12">
        <span class="tag">{{ ho.eventName }}</span>
        <span class="small muted">生成时间：{{ fmtTime(ho.createdAt) }}</span>
      </div>

      <div class="card" style="box-shadow: none; background: #fffdf9">
        <div class="card-title">🧺 物品清点</div>
        <table class="table">
          <thead><tr><th>物品名称</th><th>数量</th><th>成色</th></tr></thead>
          <tbody>
            <tr v-for="(row, i) in ho.items" :key="i">
              <td>{{ row.name }}</td>
              <td>{{ row.qty }} 件</td>
              <td>{{ row.condition }}</td>
            </tr>
          </tbody>
        </table>

        <div class="divider" />
        <div class="card-title">📷 交接照片</div>
        <div class="row wrap">
          <ItemPhoto v-for="(p, i) in ho.photos" :key="i" :photo="p" :category="item?.category ?? 'toy'" lg />
        </div>
      </div>

      <table class="table mt12">
        <tbody>
          <tr>
            <th style="width: 120px">捐赠家长</th>
            <td>{{ parent?.name }}（{{ parent?.childName }} {{ parent?.childAge }} 岁） {{ parent?.phone }}</td>
          </tr>
          <tr>
            <th>接收机构</th>
            <td>{{ charity?.orgName }} · 现场处理人 <b>{{ ho.charityHandler }}</b></td>
          </tr>
          <tr v-if="ho.staffHandler">
            <th>社区监交人</th>
            <td>{{ ho.staffHandler }}</td>
          </tr>
          <tr>
            <th>🚚 运输时间</th>
            <td>{{ ho.pickupWindow }}</td>
          </tr>
          <tr>
            <th>🧾 开票需求</th>
            <td>
              <span :class="ho.invoiceNeeded ? 'badge green' : 'badge gray'">
                {{ ho.invoiceNeeded ? '需要开具公益捐赠票据' : '无需开票' }}
              </span>
              <span v-if="ho.invoiceNote" class="small muted" style="margin-left: 8px">{{ ho.invoiceNote }}</span>
            </td>
          </tr>
          <tr v-if="ho.destination">
            <th>💚 捐赠去向</th>
            <td>{{ ho.destination }}</td>
          </tr>
        </tbody>
      </table>

      <div class="notice success mt12">
        ✅ 物品已完成现场清点交接，家长可凭此清单随时查看物品去向；如需开票或查询物流，可联系社区工作人员。
      </div>

      <div class="row mt12" style="justify-content: flex-end">
        <button class="btn primary" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Handover } from '../types'
import { useDataStore } from '../stores/data'
import { useAuthStore } from '../stores/auth'
import { fmtTime } from '../utils'
import ItemPhoto from './ItemPhoto.vue'

const props = defineProps<{ ho: Handover }>()
defineEmits<{ close: [] }>()

const data = useDataStore()
const auth = useAuthStore()
const item = computed(() => data.itemById(props.ho.itemId))
const parent = computed(() => data.userById(props.ho.parentId))
const charity = computed(() => data.userById(props.ho.charityId))

watch(
  () => props.ho.id,
  () => {
    // 只有捐赠家长本人查看时才标记已查看去向
    if (auth.currentUser?.role === 'parent' && auth.currentUser.id === props.ho.parentId) {
      data.markHandoverViewed(props.ho.id)
    }
  },
  { immediate: true },
)
</script>
