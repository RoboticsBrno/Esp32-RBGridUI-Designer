<template>
  <div
    class="blue-grey lighten-4 layout-container d-flex justify-space-between pa-1"
  >
    <v-card width="200px" class="flex-shrink-0">
      <import-dialog class="mt-4" @import-layout="onImportLayout" />

      <v-card-title>Widgets</v-card-title>

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
        <div>{{ t.name }}</div>
        <div
          v-if="t.requiredVersion !== null"
          class="text-caption text-right grey--text"
          style="flex: 1"
          :title="`This widget requires GridUI v${t.requiredVersion} or higher`"
        >
          {{ t.requiredVersion }}
        </div>
      </v-btn>

      <v-btn
        block
        text
        color="accent"
        class="justify-start mt-12"
        title="Reset the whole designer."
        @click="onResetClick"
      >
        <v-icon>mdi-delete</v-icon>
        Reset
      </v-btn>
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
      <div class="pa-2 text-right">
        <v-btn
          icon
          title="Undo (Ctrl+Z)"
          :disabled="!canUndo"
          @click="onUndoClick"
        >
          <v-icon>mdi-undo</v-icon>
        </v-btn>
        <v-btn
          icon
          title="Redo (Ctrl+Y)"
          :disabled="!canRedo"
          @click="onRedoClick"
        >
          <v-icon>mdi-redo</v-icon>
        </v-btn>
      </div>
      <v-card-title class="py-0">Properties</v-card-title>
      <div style="overflow-y: auto">
        <property-table
          :properties="properties"
          :uuid="selectedUuid"
          @prop-input="onPropertyInput"
          @prop-change="onPropertyChange"
        />
      </div>
      <v-btn
        v-if="selectedWidgets.length === 1"
        text
        color="accent"
        class="mt-4"
        title="You can also press the Delete key on your keyboard."
        @click="onDeleteClick"
      >
        <v-icon>mdi-delete</v-icon>
        Delete widget
      </v-btn>

      <v-spacer></v-spacer>
      <v-divider></v-divider>
      <v-card>
        <v-row
          dense
          align="center"
          title="Tabs require GridUI library v4.9.0 or higher."
        >
          <v-col class="shrink">
            <v-btn
              color="primary"
              :disabled="tabsCount <= 1"
              icon
              @click="modifyTabCount(-1)"
            >
              <v-icon>mdi-minus</v-icon>
            </v-btn>
          </v-col>
          <v-col class="text-center grey--text"> 4.9.0 </v-col>
          <v-col class="shrink">
            <v-btn color="primary" icon @click="modifyTabCount(1)">
              <v-icon>mdi-plus</v-icon>
            </v-btn>
          </v-col>
        </v-row>
        <v-tabs v-model="activeTab" center-active grow show-arrows>
          <v-tabs-slider></v-tabs-slider>

          <v-tab v-for="i in tabsCount" :key="i"> Tab {{ i - 1 }} </v-tab>
        </v-tabs>
      </v-card>
    </v-card>

    <div
      class="d-flex flex-column ms-2"
      style="heigth: 100%; flex: 5 1 0px; overflow: hidden"
    >
      <v-card class="mb-1 code-card" style="flex-grow: 0">
        <code-display
          :value="`${JSON.stringify(layout, null, 4)}`"
          language="javascript"
          title="Layout JSON"
          :hideable="true"
        />
      </v-card>
      <v-card class="mt-1 code-card" style="flex-grow: 0">
        <code-display
          :value="cppCode"
          language="cpp"
          title="Generated C++"
          :hideable="true"
          :hidden.sync="hideCpp"
        />
      </v-card>
      <v-card class="mt-1 code-card" style="flex-grow: 0">
        <code-display
          :value="tsCode"
          language="typescript"
          title="Generated TypeScript"
          :hideable="true"
          :hidden.sync="hideTs"
        />
      </v-card>
    </div>
  </div>
</template>

<script>
import DefaultWidgetStates from '~/src/DefaultWidgetStates'
import WidgetAdder from '~/src/WidgetAdder'
import WidgetCopyPaster from '~/src/WidgetCopyPaster'
import * as Undo from '~/src/UndoStack'
import * as CppGen from '~/src/layoutgen/Cpp'
import * as TsGen from '~/src/layoutgen/Typescript'

import CodeDisplay from '~/components/CodeDisplay'
import ImportDialog from '~/components/ImportDialog'
import PropertyTable from '~/components/PropertyTable'

import '~/gridui/web/js/01_header'
import '~/gridui/web/js/05_widget'
import '~/gridui/web/js/07_grid'

const nipplejs = process.client ? require('nipplejs') : undefined

const req = require.context('~/gridui/web/js/widgets', true, /\.js$/)
req.keys().forEach((key) => req(key))

let gGrid = null
let gWidgetAdder = null

const defaultLayout = {
  cols: 12,
  rows: 18,
  enableSplitting: true,
  drawGrid: true,
  widgets: []
}

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
          type: w,
          requiredVersion: this.formatRequiredVersion(w)
        }
      })
    }
    return {
      isScaling: false,
      isDragging: false,
      widgetTypes: types,
      clickX: 0,
      clickY: 0,
      mouseX: 0,
      mouseY: 0,
      selectedWidgets: [],
      layout: [],
      cppCode: '',
      tsCode: '',
      updateTimeout: null,
      undoStack: new Undo.UndoStack(),
      copyPaster: null,
      tabsCount: 1,
      activeTab: 0,
      hideCpp: window.localStorage.getItem('hideCpp') === 'true',
      hideTs: window.localStorage.getItem('hideTs') === 'true'
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
          type: prop.type,
          value: prop.get ? prop.get.call(w) : w[key],
          editable: prop.editable,
          options: prop.options,
          isColor: prop.isColor,
          step: prop.step
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
    },
    canUndo() {
      return this.undoStack.canUndo()
    },
    canRedo() {
      return this.undoStack.canRedo()
    }
  },
  watch: {
    activeTab(val) {
      gGrid.setCurrentTab(val)
    },
    hideCpp() {
      window.localStorage.setItem('hideCpp', this.hideCpp ? 'true' : 'false')
    },
    hideTs() {
      window.localStorage.setItem('hideTs', this.hideTs ? 'true' : 'false')
    }
  },
  mounted() {
    if (gGrid !== null) return
    window.nipplejs = nipplejs

    window.IN_RB_GRID_DESIGNER = true

    gGrid = new window.Grid(null, 'grid', this.loadLayout())

    gWidgetAdder = new WidgetAdder(gGrid, this.onWidgetAdd.bind(this))
    this.copyPaster = new WidgetCopyPaster(gGrid)

    this.updateGridCardWidth()
    window.addEventListener('resize', this.updateGridCardWidth.bind(this))
    window.addEventListener('mouseup', this.onGridMouseUp.bind(this))
    document.addEventListener('keydown', this.onKeyDown.bind(this))

    this.scheduleCodeUpdate()
    this.tabsCount = gGrid.tabs.length
  },
  methods: {
    loadLayout() {
      const saved = window.localStorage.getItem('layout')
      if (saved === null) {
        return defaultLayout
      }

      return this.fixupLegacyLayout(JSON.parse(saved))
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
    selectWidget(widget, multiple) {
      const idx = this.selectedWidgets.indexOf(widget)
      if (idx !== -1) this.selectedWidgets.splice(idx, 1)
      else {
        widget.el.classList.add('grid-widget-active')
        if (!multiple) {
          this.clearSelection(0)
        }
      }
      this.selectedWidgets.push(widget)
    },
    onGridMouseDown(ev) {
      if (ev.button !== 0) return

      this.clickX = ev.clientX
      this.clickY = ev.clientY

      const multiple = ev.shiftKey || ev.ctrlKey

      const w = gGrid.getWidgetAtPos(ev.clientX, ev.clientY)
      if (w === null) return

      this.selectWidget(w, multiple)
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
      this.undoStack.push(...moves)

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
      this.mouseX = ev.clientX
      this.mouseY = ev.clientY

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
      const uuid = this.generateUuid()

      const id = this.generateId(name)
      const tab = this.activeTab
      const state = {
        ...DefaultWidgetStates[name],
        id,
        x,
        y,
        w,
        h,
        tab
      }

      const prevLen = gGrid.widgets.length
      this.undoStack.push(new Undo.AddWidget(gGrid, uuid, name, state))
      if (prevLen < gGrid.widgets.length)
        this.selectWidget(gGrid.widgets[prevLen], false)
      this.scheduleCodeUpdate()
    },
    onKeyDown(ev) {
      if (this.isDragging || this.isScaling) return

      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')
        return

      switch (ev.key) {
        case 'Delete': {
          this.onDeleteClick()
          break
        }
        case 'z':
          if (!ev.ctrlKey) return
          if (ev.shiftKey) {
            this.onRedoClick()
          } else {
            this.onUndoClick()
          }
          break
        case 'y':
          if (!ev.ctrlKey) return
          this.onRedoClick()
          break
        case 'c':
          if (!ev.ctrlKey) return
          this.copyPaster.onCopy(this, this.selectedWidgets)
          break
        case 'v': {
          if (!ev.ctrlKey) return
          const toAdd = this.copyPaster.onPaste(this, this.mouseX, this.mouseY)
          if (!toAdd) return

          const prevLen = gGrid.widgets.length
          const ops = toAdd.map((info) => {
            const uuid = this.generateUuid()
            info.extra.id = this.generateId(info.extra.id)
            return new Undo.AddWidget(gGrid, uuid, info.type, info.extra)
          })
          this.undoStack.push(...ops)
          this.clearSelection(0)
          for (let i = prevLen; i < gGrid.widgets.length; ++i) {
            this.selectWidget(gGrid.widgets[i], true)
          }
          this.scheduleCodeUpdate()
          break
        }
      }
    },
    onDeleteClick() {
      const ops = []
      for (const w of this.selectedWidgets) {
        ops.push(new Undo.DeleteWidget(gGrid, w))
      }
      this.undoStack.push(...ops)
      this.clearSelection(0)
      this.scheduleCodeUpdate()
    },
    onUndoClick() {
      this.undoStack.undo()
      this.refreshSelectedWidgets()
      this.scheduleCodeUpdate()
    },
    onRedoClick() {
      this.undoStack.redo()
      this.refreshSelectedWidgets()
      this.scheduleCodeUpdate()
    },
    onImportLayout(layout) {
      layout = this.fixupLegacyLayout(layout)
      this.undoStack.push(new Undo.ReplaceLayout(gGrid, this.layout, layout))
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
      this.cppCode = CppGen.generate(gGrid.widgets, this.layout)
      this.tsCode = TsGen.generate(gGrid.widgets, this.layout)
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

      this.undoStack.push(
        new Undo.ChangeProperty(
          gGrid,
          this.selectedWidgets[0],
          name,
          oldValue,
          value
        )
      )

      if (name === 'tab') {
        gGrid.moveToTab(this.selectedWidgets[0], value, oldValue)
        this.tabsCount = gGrid.tabs.length
      }
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
    },
    generateUuid() {
      let uuid
      do {
        uuid = (1 + Math.random() * 65534) | 0
      } while (gGrid.getWidgetByUuid(uuid) !== null)
      return uuid
    },
    isValidUuid(uuid) {
      return uuid > 0 && uuid < 65536
    },
    onResetClick() {
      const ok = window.confirm(
        'This will reset the whole layout and you will NOT be albe to undo this. Continue?'
      )
      if (ok) {
        window.localStorage.removeItem('layout')
        window.location.reload()
      }
    },
    fixupLegacyLayout(layout) {
      layout.drawGrid = true
      for (const w of layout.widgets) {
        if (w.state.id === undefined) {
          w.state.id = this.generateId(w.type)
        }
        if (!this.isValidUuid(w.uuid)) {
          w.uuid = this.generateUuid()
        }
        if (!w.tab) w.tab = 0
      }
      return layout
    },
    formatRequiredVersion(w) {
      const ver = w.prototype.MIN_LIBRARY_VERSION
      if (ver === 0x040000) return null
      return `${(ver >> 16).toString(16)}.${((ver >> 8) & 0xff).toString(
        16
      )}.${(ver & 0xff).toString(16)}`
    },
    modifyTabCount(delta) {
      if (this.tabsCount + delta < 1) {
        return
      }

      this.undoStack.push(
        new Undo.SetTabCount(
          this,
          gGrid,
          this.tabsCount,
          this.tabsCount + delta
        )
      )
      this.clearSelection(0)
      this.scheduleCodeUpdate()
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
  display: flex;

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
