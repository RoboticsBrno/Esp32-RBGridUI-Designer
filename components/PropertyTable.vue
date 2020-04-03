<template>
  <div class="pa-2">
    <table v-if="Object.keys(properties).length !== 0" class="property-table">
      <template v-for="(props, section) in properties">
        <tr :key="section">
          <th colspan="2" class="primary--text pb-1 pt-3">{{ section }}</th>
        </tr>
        <tr v-for="(prop, name) in props" :key="name">
          <td class="text-right property-name" style="width: 90px">
            <b>{{ name }}</b>
          </td>
          <td class="text-no-wrap">
            <input
              v-if="prop.type === Boolean"
              type="checkbox"
              :checked="prop.value"
            />
            <input
              v-else-if="prop.type === Number"
              type="number"
              step="0.5"
              style="width: 100%"
              :value="prop.value"
            />
            <input
              v-else-if="prop.type === String"
              type="text"
              style="width: 100%"
              :value="prop.value"
            />
            <div
              v-else
              class="grey--text text--lighten-1"
              style="cursor: not-allowed"
            >
              {{ prop.value }}
            </div>
          </td>
        </tr>
      </template>
    </table>
    <div v-else class="py-12 grey--text text-center">
      Select a single widget.
    </div>
  </div>
</template>

<script>
export default {
  props: {
    properties: {
      type: Object,
      required: true
    }
  },
  data() {
    return {}
  },
  methods: {}
}
</script>

<style lang="scss">
.property-table {
  width: 100%;
  border-collapse: collapse;

  td {
    padding: 0px 4px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    border-bottom: 1px solid #ccc;
  }

  th {
    border-bottom: 1px solid #ccc;
  }

  input {
    vertical-align: middle;
  }
}

.property-name {
  border-right: 1px solid #ccc;
}
</style>
