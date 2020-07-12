<template>
  <div class="pa-2">
    <table v-if="Object.keys(properties).length !== 0" class="property-table">
      <template v-for="(props, section) in properties">
        <tr :key="section">
          <th colspan="2" class="primary--text pb-1 pt-3">{{ section }}</th>
        </tr>
        <tr
          v-for="(prop, name) in props"
          :key="name"
          :class="{ 'id-row': name === 'id' }"
        >
          <td class="text-right property-name" style="width: 90px;">
            <b>{{ name }}</b>
          </td>
          <td class="text-no-wrap">
            <input
              v-if="prop.editable && prop.type === Boolean"
              v-model="models[name]"
              type="checkbox"
              @input="onValueChange(name)"
            />
            <select
              v-else-if="prop.editable && prop.options"
              v-model="models[name]"
              style="width: 100%;"
              @change="onValueChange(name)"
            >
              <option v-for="o in prop.options" :key="o">{{ o }}</option>
            </select>
            <input
              v-else-if="prop.editable && prop.type === Number"
              v-model="models[name]"
              type="number"
              step="0.5"
              style="width: 100%;"
              @change="onValueChange(name)"
            />
            <div
              v-else-if="prop.editable && prop.type === String"
              class="d-flex"
            >
              <input
                v-model="models[name]"
                type="text"
                style="min-width: 80%;"
                @change="onValueChange(name)"
              />
              <input
                v-if="prop.isColor"
                v-model="models[name]"
                class="py-1"
                style="min-width: 10%;"
                type="color"
                @change="onValueChange(name)"
              />
            </div>
            <object-property-editor
              v-else-if="prop.editable && prop.type === Object"
              v-model="models[name]"
              :name="name"
              @change="onValueChange(name)"
            />
            <div
              v-else
              class="grey--text text--lighten-1"
              style="cursor: not-allowed;"
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
    },
    uuid: {
      type: Number,
      required: true
    }
  },
  data() {
    return {
      originalInput: {},
      originalChange: {},
      models: {}
    }
  },
  watch: {
    uuid() {
      if (this.uuid !== -1) this.originalChange = this.copyProperties()
    },
    properties: {
      deep: true,
      handler() {
        this.originalInput = this.copyProperties()
        this.models = this.copyProperties()
      }
    },
    models: {
      deep: true,
      handler() {
        for (const [key, curVal] of Object.entries(this.models)) {
          if (!this.propEquals(curVal, this.originalInput[key])) {
            this.$emit('prop-input', key, curVal)
            this.$set(this.originalInput, key, curVal)
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
    },
    onValueChange(name) {
      const curVal = this.models[name]
      const oldVal = this.originalChange[name]
      if (!this.propEquals(curVal, oldVal)) {
        this.$emit('prop-change', name, curVal, oldVal)
        this.$set(this.originalChange, name, curVal)
      }
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

.id-row {
  font-size: 105%;
  td:nth-child(2) {
    font-weight: bold;
    color: var(--v-secondary-base);
  }
}

.property-name {
  border-right: 1px solid #ccc;
}
</style>
