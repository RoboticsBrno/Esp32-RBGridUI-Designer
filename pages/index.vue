<template>
  <div
    class="blue-grey lighten-4 layout-container d-flex justify-space-between pa-1"
  >
    <v-card class="pa-2" width="200px">
      <v-card-title>Widgets</v-card-title>

      <client-only>
        <v-btn
          v-for="t in widgetTypes"
          :key="t.name"
          block
          text
          color="primary"
          class="justify-start add-button"
          large
          @mousedown="onAddWidgetDown($event, t.type)"
        >
          {{ t.name }}
        </v-btn>
      </client-only>
    </v-card>

    <div
      id="grid-wrapper"
      class="d-flex align-center justify-center my-12 mx-6"
      style="flex: 3 1 0px !important"
    >
      <v-card id="grid-card">
        <div
          id="grid"
          @mousedown="onGridMouseDown"
          @mousemove="onGridMouseMove"
        ></div>
      </v-card>
    </div>

    <v-card width="250px" class="d-flex py-1 flex-column">
      <v-card-title class="pb-0">Properties</v-card-title>
      <div style="overflow-y: auto;" class="flex-grow-1">
        <property-table :properties="properties" />
      </div>
    </v-card>

    <div class="d-flex flex-column ms-2" style="heigth: 100%; flex-grow: 4">
      <v-card
        class="pa-2 mb-1 text-monospace"
        style="overflow-y: auto; flex: 1 1 0px;"
      >
        <pre
          style="height: 100%; font-size: 10px;"
          v-text="`${JSON.stringify(layout, null, 4)}`"
        ></pre>
      </v-card>
      <v-card class="pa-2 mt-1" style="flex: 1 1 0px;"> </v-card>
    </div>
  </div>
</template>

<script>
import DefaultWidgetStates from '~/src/DefaultWidgetStates'
import WidgetAdder from '~/src/WidgetAdder'
import { UndoStack, AddWidget, DeleteWidget, MoveWidget } from '~/src/UndoStack'

import PropertyTable from '~/components/PropertyTable'

import '~/gridui/web/js/00_header'
import '~/gridui/web/js/05_widget'
import '~/gridui/web/js/07_grid'

const nipplejs = process.client ? require('nipplejs') : undefined

const req = require.context('~/gridui/web/js/widgets', true, /\.js$/)
req.keys().forEach(function(key) {
  req(key)
})

let gGrid = null
let gWidgetAdder = null
const gUndoStack = new UndoStack()

export default {
  components: {
    PropertyTable
  },
  data() {
    let types = []
    if (process.client && window.Widget) {
      types = window.Widget.SUBCLASSES.map((w) => {
        return {
          name: w.name,
          type: w
        }
      })
    }
    return {
      isScaling: false,
      isDragging: false,
      widgetTypes: types,
      clickX: 0,
      clickY: 0,
      selectedWidgets: [],
      layout: []
    }
  },
  computed: {
    properties() {
      if (this.selectedWidgets.length !== 1) return {}

      const w = this.selectedWidgets[0]
      const general = {}
      const perWidget = {}

      const proto = Object.getPrototypeOf(w)
      for (const [key, prop] of Object.entries(proto.PROPERTIES)) {
        const val = {
          type: prop.types[0],
          value: prop.get ? prop.get.call(w) : w[key]
        }
        if (key in window.Widget.prototype.PROPERTIES) {
          general[key] = val
        } else {
          perWidget[key] = val
        }
      }

      const res = { General: general }
      res[w.constructor.name] = perWidget
      return res
    }
  },
  mounted() {
    window.nipplejs = nipplejs
    gGrid = new window.Grid(null, 'grid', window.GRID_DATA)

    gWidgetAdder = new WidgetAdder(gGrid, this.onWidgetAdd.bind(this))

    this.updateGridCardWidth()
    window.addEventListener('resize', this.updateGridCardWidth.bind(this))
    window.addEventListener('mouseup', this.onGridMouseUp.bind(this))
    document.addEventListener('keydown', this.onKeyDown.bind(this))

    this.updateLayout()
  },
  methods: {
    updateGridCardWidth() {
      const card = document.getElementById('grid-card')

      const calcDimensions = () => {
        const wrapper = document.getElementById('grid-wrapper')
        const rect = wrapper.getBoundingClientRect()

        let width = rect.width
        let height = (rect.width / 9) * 16
        if (height > rect.height) {
          width = (rect.height / 16) * 9
          height = rect.height
        }

        card.style.width = width + 'px'
        card.style.height = height + 'px'

        gGrid.onResize()
      }

      if (
        card.style.removeProperty('width') === '' &&
        card.style.removeProperty('height') === ''
      ) {
        calcDimensions()
      } else {
        setTimeout(calcDimensions, 0)
      }
    },
    onGridMouseDown(ev) {
      if (ev.button !== 0) return

      this.clickX = ev.clientX
      this.clickY = ev.clientY

      const multiple = ev.shiftKey || ev.ctrlKey

      const w = gGrid.getWidgetAtPos(ev.clientX, ev.clientY)
      if (w === null) return

      const idx = this.selectedWidgets.indexOf(w)
      if (idx !== -1) this.selectedWidgets.splice(idx, 1)
      else {
        w.el.classList.add('grid-widget-active')
        if (!multiple) {
          this.clearSelection(0)
        }
      }
      this.selectedWidgets.push(w)

      const rect = w.el.getBoundingClientRect()
      if (
        !multiple &&
        Math.abs(rect.right - ev.clientX) < 12 &&
        Math.abs(rect.bottom - ev.clientY) < 12
      ) {
        this.isScaling = true
        this.clearSelection(1)
        w.mouseOffX = ev.clientX - rect.right
        w.mouseOffY = ev.clientY - rect.bottom
        w.origPos = w.pos()
      } else {
        this.isDragging = true
        for (const w of this.selectedWidgets) {
          const rect = w.el.getBoundingClientRect()
          w.mouseOffX = ev.clientX - rect.left
          w.mouseOffY = ev.clientY - rect.top
          w.origPos = w.pos()
        }
      }
    },
    onGridMouseUp(ev) {
      if (!this.isDragging && !this.isScaling) return

      const moves = []
      for (const w of this.selectedWidgets) {
        if (!w.pos().equals(w.origPos)) {
          moves.push(new MoveWidget(w, w.origPos))
        }
        delete w.mouseOffX
        delete w.mouseOffY
        delete w.origPos
      }
      gUndoStack.push(...moves)

      const multiple = ev.shiftKey || ev.ctrlKey
      if (
        !multiple &&
        Math.abs(this.clickX - ev.clientX) < 4 &&
        Math.abs(this.clickY - ev.clientY) < 4
      ) {
        this.clearSelection(1)
      }

      this.isDragging = false
      this.isScaling = false
    },
    onGridMouseMove(ev) {
      if (!this.isDragging && !this.isScaling) return

      const method = this.isDragging
        ? gGrid.tryMoveWidget
        : gGrid.tryScaleWidget
      for (const w of this.selectedWidgets) {
        if (
          method.call(
            gGrid,
            w,
            ev.clientX - w.mouseOffX,
            ev.clientY - w.mouseOffY
          )
        ) {
          this.clickX = 0
          this.clickY = 0
        }
      }
      this.updateLayout()
    },
    clearSelection(keepCount) {
      if (this.selectedWidgets.length < 1 + keepCount) return
      const removed = this.selectedWidgets.splice(
        0,
        this.selectedWidgets.length - keepCount
      )
      for (const w of removed) {
        w.el.classList.remove('grid-widget-active')
      }
    },
    onAddWidgetDown(ev, widgetType) {
      gWidgetAdder.onAddWidgetDown(ev, widgetType)
    },
    onWidgetAdd(name, x, y, w, h) {
      const widget = new window[name](gGrid, (Math.random() * 10000) | 0)
      widget.applyState({
        ...DefaultWidgetStates[name],
        x,
        y,
        w,
        h
      })
      gUndoStack.push(new AddWidget(gGrid, widget))
      this.updateLayout()
    },
    onKeyDown(ev) {
      if (this.isDragging || this.isScaling) return

      switch (ev.key) {
        case 'Delete': {
          const ops = []
          for (const w of this.selectedWidgets) {
            ops.push(new DeleteWidget(gGrid, w))
          }
          gUndoStack.push(...ops)
          this.clearSelection(0)
          break
        }
        case 'z':
          if (!ev.ctrlKey) return
          if (ev.shiftKey) {
            gUndoStack.redo()
          } else {
            gUndoStack.undo()
          }
          break
        case 'y':
          if (!ev.ctrlKey) return
          gUndoStack.redo()
          break
      }
    },
    updateLayout() {
      const widgets = []
      for (const w of gGrid.widgets) {
        widgets.push({
          uuid: w.uuid,
          type: w.constructor.name,
          state: w.getState()
        })
      }

      this.layout = {
        cols: gGrid.COLS,
        rows: gGrid.ROWS,
        enableSplitting: gGrid.enableSplitting,
        widgets: widgets
      }
    }
  }
}
</script>

<style lang="scss">
.layout-container {
  position: absolute;
  top: 0;
  bottom: 0;
  max-width: 1920px;
  margin-left: auto;
  margin-right: auto;
  left: 0;
  right: 0;
}

.add-button {
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

#grid-card {
  margin: 50px 0px;
  overflow: hidden;
}

#grid {
  width: 100%;
  height: 100%;
}

.grid-widget {
  pointer-events: none;
  user-select: none;

  &:before {
    position: absolute;
    right: 0px;
    bottom: 0px;
    padding: 4px;
    margin: 4px;
    z-index: 10;
    border-bottom: 2px solid #666;
    border-right: 2px solid #666;
    content: '';
  }

  &:after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    border: 2px dashed #666 !important;
    z-index: 10;
    content: '';
  }
}

.grid-widget-active:after {
  border: 3px dashed red !important;
}
</style>
