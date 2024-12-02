<template>
  <div class="pa-2" style="overflow: auto; max-height: 400px">
    <table class="widget-table">
      <tr>
        <th colspan="2">Widgets</th>
      </tr>
      <tr v-for="(w, idx) in widgetsSorted" :key="w.uuid">
        <td
          :class="{ 'widget-id': true, selected: selectedWidgets.includes(w) }"
          @click.prevent.self.capture="onSelectClick(idx, w, arguments[0])"
        >
          {{ w.id }}
        </td>
        <td class="widget-actions">
          <v-btn
            icon
            title="Hide this widget"
            small
            :color="w.uuid in hidden ? 'orange' : undefined"
            @click="onHideClick(w)"
          >
            <v-icon v-if="w.uuid in hidden">mdi-eye-off</v-icon>
            <v-icon v-else>mdi-eye</v-icon>
          </v-btn>
        </td>
      </tr>
    </table>
  </div>
</template>

<script>
export default {
  props: {
    widgets: {
      type: Array,
      required: true
    },
    selectedWidgets: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      hidden: {}
    }
  },
  computed: {
    widgetsSorted() {
      const res = this.widgets.slice()
      res.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()))
      return res
    }
  },
  methods: {
    onSelectClick(idx, w, ev) {
      if (ev.shiftKey) {
        let newSelection
        if (this.selectedWidgets.length > 0) {
          const prev = this.widgetsSorted.indexOf(
            this.selectedWidgets[this.selectedWidgets.length - 1]
          )
          if (prev < idx) {
            newSelection = this.widgetsSorted.slice(prev, idx + 1)
          } else {
            newSelection = this.widgetsSorted.slice(idx, prev + 1)
          }
        } else {
          newSelection = [w]
        }

        this.$emit('clear-selection', 0)
        for (const w of newSelection) {
          this.$emit('select-widget', w, true)
        }
      } else {
        if (!ev.ctrlKey) {
          this.$emit('clear-selection', 0)
        }
        this.$emit('select-widget', w, ev.ctrlKey)
      }
    },
    onHideClick(widget) {
      const show = widget.uuid in this.hidden
      let widgets = [widget]

      if (this.selectedWidgets.includes(widget)) {
        widgets = this.selectedWidgets
      }

      for (const w of widgets) {
        if (show) {
          this.$delete(this.hidden, w.uuid)
          w.el.style.visibility = 'unset'
        } else {
          this.$set(this.hidden, w.uuid, true)
          w.el.style.visibility = 'hidden'
        }
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.widget-table {
  width: 100%;
  border-collapse: collapse;

  td {
    padding: 0px 4px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    border-bottom: 1px solid #ccc;
    user-select: none;
  }

  .widget-id {
    cursor: pointer;
  }

  .selected {
    color: red;
  }

  .widget-actions {
    text-align: right;
  }

  th {
    border-bottom: 1px solid #ccc;
  }
}
</style>
