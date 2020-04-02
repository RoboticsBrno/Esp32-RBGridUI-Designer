<template>
  <div class="blue-grey lighten-4 container">
    <v-card id="widget-list"></v-card>

    <v-card id="grid-card">
      <div
        id="grid"
        @mousedown="onGridMouseDown"
        @mousemove="onGridMouseMove"
      ></div>
    </v-card>
  </div>
</template>

<script>
import '~/gridui/web/js/00_header'
import '~/gridui/web/js/05_widget'
import '~/gridui/web/js/07_grid'

const nipplejs = process.client ? require('nipplejs') : undefined

const req = require.context('~/gridui/web/js/widgets', true, /\.js$/)
req.keys().forEach(function(key) {
  req(key)
})

let gGrid = null
let gSelectedWidget = null

export default {
  data() {
    return {
      isScaling: false,
      isDragging: false,
      mouseOffX: 0,
      mouseOffY: 0
    }
  },
  mounted() {
    window.nipplejs = nipplejs
    gGrid = new window.Grid(null, 'grid', window.GRID_DATA)

    this.updateGridCardWidth()
    window.addEventListener('resize', this.updateGridCardWidth.bind(this))
    window.addEventListener('mouseup', this.onGridMouseUp.bind(this))
  },
  methods: {
    updateGridCardWidth() {
      const el = document.getElementById('grid-card')
      el.style.width = (el.getBoundingClientRect().height / 16) * 9 + 'px'
      gGrid.onResize()
    },
    onGridMouseDown(ev) {
      if (gSelectedWidget !== null) {
        gSelectedWidget.el.classList.remove('grid-widget-active')
        gSelectedWidget = null
      }
      gSelectedWidget = gGrid.getWidgetAtPos(ev.clientX, ev.clientY)
      if (gSelectedWidget !== null) {
        gSelectedWidget.el.classList.add('grid-widget-active')

        const rect = gSelectedWidget.el.getBoundingClientRect()
        if (
          Math.abs(rect.right - ev.clientX) < 12 &&
          Math.abs(rect.bottom - ev.clientY) < 12
        ) {
          this.isScaling = true
          this.mouseOffX = ev.clientX - rect.right
          this.mouseOffY = ev.clientY - rect.bottom
        } else {
          this.isDragging = true
          this.mouseOffX = ev.clientX - rect.left
          this.mouseOffY = ev.clientY - rect.top
        }
      }
    },
    onGridMouseUp(ev) {
      this.isDragging = false
      this.isScaling = false
    },
    onGridMouseMove(ev) {
      if (this.isDragging) {
        gGrid.tryMoveWidget(
          gSelectedWidget,
          ev.clientX - this.mouseOffX,
          ev.clientY - this.mouseOffY
        )
      } else if (this.isScaling) {
        gGrid.tryScaleWidget(
          gSelectedWidget,
          ev.clientX - this.mouseOffX,
          ev.clientY - this.mouseOffY
        )
      }
    }
  }
}
</script>

<style lang="scss">
.container {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
}

#widget-list {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 250px;
}

#grid-card {
  position: absolute;
  top: 10%;
  bottom: 10%;
  left: 350px;
  overflow: hidden;
}

#grid {
  width: 100%;
  height: 100%;
}

.grid-widget {
  pointer-events: none;
  user-select: none;

  border: 2px dashed #666 !important;

  &:after {
    position: absolute;
    right: 0px;
    bottom: 0px;
    padding: 4px;
    margin: 1px;
    z-index: 1000;
    border-bottom: 2px solid #666;
    border-right: 2px solid #666;
    content: '';
  }
}

.grid-widget-active {
  border: 3px dashed red !important;
}
</style>
