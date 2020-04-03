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
              v-if="prop.editable && prop.type === Boolean"
              v-model="models[name]"
              type="checkbox"
            />
            <input
              v-else-if="prop.editable && prop.type === Number"
              v-model="models[name]"
              type="number"
              step="0.5"
              style="width: 100%"
            />
            <input
              v-else-if="prop.editable && prop.type === String"
              v-model="models[name]"
              type="text"
              style="width: 100%"
            />
            <object-property-editor
              v-else-if="prop.editable && prop.type === Object"
              v-model="models[name]"
              :name="name"
            />
            <div
              v-else
              class="grey--text text--lighten-1"
              style="cursor: not-allowed"
            >
              {{ models[name] }}
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
import clone from 'rfdc'
import deepEqual from 'deep-equal'

import ObjectPropertyEditor from './ObjectPropertyEditor'

export default {
  components: {
    ObjectPropertyEditor
  },
  props: {
    properties: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      originalValues: {},
      models: {}
    }
  },
  watch: {
    properties: {
      deep: true,
      handler() {
        this.originalValues = this.copyProperties()
        this.models = this.copyProperties()
      }
    },
    models: {
      deep: true,
      handler() {
        for (const [key, curVal] of Object.entries(this.models)) {
          if (!this.propEquals(curVal, this.originalValues[key])) {
            this.$emit('prop-changed', key, curVal)
            this.$set(this.originalValues, key, curVal)
          }
        }
      }
    }
  },
  methods: {
    propEquals(a, b) {
      if (a instanceof Object) {
        return deepEqual(a, b, { strict: true })
      }
      return a === b
    },
    copyProperties() {
      const vals = {}
      for (const props of Object.values(this.properties)) {
        for (const [key, prop] of Object.entries(props)) {
          vals[key] = clone()(prop.value)
        }
      }
      return vals
    }
  }
}
</script>

<style lang="scss" scoped>
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
