<template>
  <v-dialog v-model="show" width="500" style="z-index: 1000">
    <template v-slot:activator="{ on }">
      <v-btn text color="primary" small v-on="on">
        edit
      </v-btn>
    </template>

    <v-card style="overflow-y: auto" max-height="600px">
      <v-card-title> Editing '{{ name }}' </v-card-title>

      <v-simple-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(val, key) in value" :key="key">
            <td style="width: 150px">
              <input
                :value="key"
                class="object-property-name"
                type="text"
                style="font-weight: bold"
                tabindex="0"
                @change="onKeyChange(key, $event.target.value)"
              />
            </td>
            <td>
              <input v-model="value[key]" tabindex="0" type="text" />
            </td>
            <td style="width: 1%">
              <v-btn icon @click="$delete(value, key)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </td>
          </tr>
          <tr>
            <td colspan="3" class="text-right">
              <v-btn text color="primary" @click="onNewPropertyClick">
                <v-icon>mdi-plus</v-icon> New property
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-simple-table>
    </v-card>
  </v-dialog>
</template>

<script>
import deepEqual from 'deep-equal'
import clone from 'rfdc'

export default {
  props: {
    name: {
      type: String,
      required: true
    },
    value: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      show: false,
      originalValue: null
    }
  },
  watch: {
    show() {
      if (!this.show) {
        if (!deepEqual(this.value, this.originalValue))
          this.$emit('change', this.value)
      } else {
        this.originalValue = clone()(this.value)
      }
    }
  },
  methods: {
    onKeyChange(old, cur) {
      if (old === cur) return

      const newValues = {}
      for (const [key, val] of Object.entries(this.value)) {
        if (key === old) {
          newValues[cur] = val
        } else {
          newValues[key] = val
        }
      }
      this.$emit('input', newValues)
    },
    onNewPropertyClick() {
      if (!('' in this.value)) {
        this.$set(this.value, '', '')
      }
      this.$nextTick(() => {
        for (const input of document.querySelectorAll(
          'input.object-property-name'
        )) {
          if (input.value === '') {
            input.focus()
            break
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
input {
  width: 100%;
}
</style>
