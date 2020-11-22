const clone = require('rfdc')()

export default class {
  constructor(grid) {
    this.grid = grid
    this.clipboard = []
  }

  onCopy(vue, selectedWidgets) {
    if (selectedWidgets.length === 0) {
      this.clipboard = []
      vue.$notify({
        group: 'warn',
        title: `No widgets are selected in the layout.`,
        text: 'Select some before copying.'
      })
      return
    }

    this.clipboard = selectedWidgets.map((w) => {
      return {
        type: w.constructor.name,
        extra: w.getState()
      }
    })

    vue.$notify({
      group: 'info',
      title: `${this.clipboard.length} widgets copied`,
      text: "Press 'Ctrl+V' to paste them in."
    })
  }

  onPaste(vue, clientX, clientY) {
    if (this.clipboard.length === 0) {
      vue.$notify({
        group: 'error',
        title: `The clipboard is empty!`,
        text: "Select some widgets and press 'Ctrl+C'."
      })
      return null
    }

    const rect = {
      x1: this.clipboard[0].extra.x,
      y1: this.clipboard[0].extra.y,
      x2: this.clipboard[0].extra.x + this.clipboard[0].extra.w,
      y2: this.clipboard[0].extra.y + this.clipboard[0].extra.h
    }
    for (let i = 1; i < this.clipboard.length; ++i) {
      const e = this.clipboard[i].extra
      rect.x1 = Math.min(rect.x1, e.x)
      rect.y1 = Math.min(rect.y1, e.y)
      rect.x2 = Math.max(rect.x2, e.x + e.w)
      rect.y2 = Math.max(rect.y2, e.y + e.h)
    }

    let { x, y } = this.grid.pxPosToCoordinates(clientX, clientY)
    x = Math.max(0, x)
    y = Math.max(0, y)

    const dx = x - (rect.x1 + (rect.x2 - rect.x1) / 2)
    const dy = y - (rect.y1 + (rect.y2 - rect.y1) / 2)

    return this.clipboard.map((w) => {
      const cp = clone(w)
      cp.extra.x = this.grid.roundToPrecision(cp.extra.x + dx, 0.5)
      cp.extra.y = this.grid.roundToPrecision(cp.extra.y + dy, 0.5)
      return cp
    })
  }
}
