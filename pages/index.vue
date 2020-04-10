<template>
  <div
    class="blue-grey lighten-4 layout-container d-flex justify-space-between pa-1"
  >
    <v-card width="200px" class="flex-shrink-0">
      <import-dialog class="mt-4" @import-layout="onImportLayout" />
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
      style="flex: 4 1 0px"
    >
      <v-card id="grid-card">
        <div id="log">This is the log.</div>
        <div
          id="grid"
          @mousedown="onGridMouseDown"
          @mousemove="onGridMouseMove"
        ></div>
      </v-card>
    </div>

    <v-card width="250px" class="d-flex py-1 flex-column flex-shrink-0">
      <v-card-title class="pb-0">Properties</v-card-title>
      <div style="overflow-y: auto;" class="flex-grow-1">
        <property-table
          :properties="properties"
          :uuid="selectedUuid"
          @prop-input="onPropertyInput"
          @prop-change="onPropertyChange"
        />
      </div>
    </v-card>

    <div
      class="d-flex flex-column ms-2"
      style="heigth: 100%; flex: 5 1 0px; overflow: hidden;"
    >
      <v-card class="mb-1 code-card" style="flex-grow: 0">
        <code-display
          :value="`${JSON.stringify(layout, null, 4)}`"
          language="javascript"
          title="Layout JSON"
          :hideable="true"
        />
      </v-card>
      <v-card class="mt-1 code-card">
        <code-display :value="cppCode" language="cpp" title="Generated C++" />
      </v-card>
    </div>
  </div>
</template>

<script>
import DefaultWidgetStates from '~/src/DefaultWidgetStates'
import WidgetAdder from '~/src/WidgetAdder'
import * as Undo from '~/src/UndoStack'
import * as Header from '~/src/cppgenerator/Header'

import CodeDisplay from '~/components/CodeDisplay'
import ImportDialog from '~/components/ImportDialog'
import PropertyTable from '~/components/PropertyTable'

import '~/gridui/web/js/00_header'
import '~/gridui/web/js/05_widget'
import '~/gridui/web/js/07_grid'

const nipplejs = process.client ? require('nipplejs') : undefined

const req = require.context('~/gridui/web/js/widgets', true, /\.js$/)
req.keys().forEach((key) => req(key))

let gGrid = null
let gWidgetAdder = null
const gUndoStack = new Undo.UndoStack()

export default {
  components: {
    CodeDisplay,
    ImportDialog,
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
      layout: [],
      cppCode: '',
      updateTimeout: null
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
          value: prop.get ? prop.get.call(w) : w[key],
          editable: prop.editable
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
    },
    selectedUuid() {
      if (this.selectedWidgets.length === 1) {
        return this.selectedWidgets[0].uuid
      }
      return -1
    }
  },
  mounted() {
    if (gGrid !== null) return
    window.nipplejs = nipplejs

    gGrid = new window.Grid(null, 'grid', this.loadLayout())

    for (const w of gGrid.widgets) {
      if (w.id === undefined) {
        w.id = this.generateId(w.constructor.name)
      }
    }

    gWidgetAdder = new WidgetAdder(gGrid, this.onWidgetAdd.bind(this))

    this.updateGridCardWidth()
    window.addEventListener('resize', this.updateGridCardWidth.bind(this))
    window.addEventListener('mouseup', this.onGridMouseUp.bind(this))
    document.addEventListener('keydown', this.onKeyDown.bind(this))

    this.scheduleCodeUpdate()
  },
  methods: {
    loadLayout() {
      const saved = window.localStorage.getItem('layout')
      if (saved === null) {
        return {
          cols: 12,
          rows: 18,
          enableSplitting: true,
          widgets: []
        }
      }

      return JSON.parse(saved)
    },
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
      this.scheduleCodeUpdate()

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
          moves.push(new Undo.MoveWidget(gGrid, w, w.origPos))
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
      this.scheduleCodeUpdate()
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
      let uuid
      do {
        uuid = (Math.random() * 1000000) | 0
      } while (gGrid.getWidgetByUuid(uuid) !== null)

      const id = this.generateId(name)
      const state = {
        ...DefaultWidgetStates[name],
        id,
        x,
        y,
        w,
        h
      }

      gUndoStack.push(new Undo.AddWidget(gGrid, uuid, name, state))
      this.scheduleCodeUpdate()
    },
    onKeyDown(ev) {
      if (this.isDragging || this.isScaling) return

      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')
        return

      switch (ev.key) {
        case 'Delete': {
          const ops = []
          for (const w of this.selectedWidgets) {
            ops.push(new Undo.DeleteWidget(gGrid, w))
          }
          gUndoStack.push(...ops)
          this.clearSelection(0)
          this.scheduleCodeUpdate()
          break
        }
        case 'z':
          if (!ev.ctrlKey) return
          if (ev.shiftKey) {
            gUndoStack.redo()
          } else {
            gUndoStack.undo()
          }
          this.refreshSelectedWidgets()
          this.scheduleCodeUpdate()
          break
        case 'y':
          if (!ev.ctrlKey) return
          gUndoStack.redo()
          this.refreshSelectedWidgets()
          this.scheduleCodeUpdate()
          break
      }
    },
    onImportLayout(layout) {
      gUndoStack.push(new Undo.ReplaceLayout(gGrid, this.layout, layout))
      this.selectedWidgets = []
      this.scheduleCodeUpdate()
    },
    scheduleCodeUpdate() {
      if (!process.client || this.updateTimeout !== null) return
      this.updateTimeout = setTimeout(() => {
        this.updateLayout()
        this.updateCpp()
        this.updateTimeout = null
      }, 100)
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

      const layout = {
        cols: gGrid.COLS,
        rows: gGrid.ROWS,
        enableSplitting: gGrid.enableSplitting,
        widgets: widgets
      }

      window.localStorage.setItem('layout', JSON.stringify(layout))
      this.layout = layout
    },
    updateCpp() {
      this.cppCode = Header.generate(gGrid.widgets, this.layout)
    },
    refreshSelectedWidgets() {
      const filtered = this.selectedWidgets.filter((w) =>
        gGrid.widgets.includes(w)
      )
      if (filtered.length !== this.selectedWidgets.length) {
        this.selectedWidgets = filtered
      }
    },
    onPropertyInput(name, value) {
      if (this.selectedWidgets.length !== 1) return

      const state = {}
      state[name] = value

      this.selectedWidgets[0].applyState(state)
      this.scheduleCodeUpdate()
    },
    onPropertyChange(name, value, oldValue) {
      if (this.selectedWidgets.length !== 1) return

      if (name === 'id') {
        value = value.replace(/[^A-Za-z0-9_]/g, '')
        if (!/^[A-Za-z]/.test(value)) value = 'w' + value
        this.onPropertyInput(name, this.generateId(value, true))
      }

      gUndoStack.push(
        new Undo.ChangeProperty(
          gGrid,
          this.selectedWidgets[0],
          name,
          oldValue,
          value
        )
      )
    },
    generateId(typeName, allowSameAsTypeName) {
      const widgetIds = Object.fromEntries(
        gGrid.widgets.map((w) => [w.id, true])
      )

      if (allowSameAsTypeName === true && !(typeName in widgetIds)) {
        return typeName
      }

      for (let i = 1; true; ++i) {
        const id = `${typeName}${i}`
        if (!(id in widgetIds)) {
          return id
        }
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

#log {
  padding: 3px;
  font-size: 11px;
  font-family: monospace;
  background-color: black;
  color: #62f442;
  white-space: pre-line;
  overflow-y: auto;
  height: 60px;
}

#grid {
  position: absolute;
  width: 100%;
  top: 60px;
  bottom: 0px;
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

button.grid-widget {
  background-color: #eee;
}

.grid-widget-active:after {
  border: 3px dashed red !important;
}

.code-card {
  flex: auto;
  min-height: 50px;
  overflow: hidden;
}
</style>
