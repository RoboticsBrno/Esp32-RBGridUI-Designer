import DefaultWidgetStates from './DefaultWidgetStates'

export default class {
  constructor(grid, callback) {
    this.grid = grid
    this.callback = callback

    this.widget = null
    this.mouseX = 0
    this.mouseY = 0

    this.mouseMoveListener = this.onMouseMove.bind(this)
    this.mouseUpListener = this.onMouseUp.bind(this)
  }

  onAddWidgetDown(ev, type) {
    if (ev.button !== 0) return
    this.mouseX = ev.clientX
    this.mouseY = ev.clientY

    this.widget = new window[type.name](this, 0)
    Object.assign(this.widget.el.style, {
      zIndex: 1000,
      cursor: 'grabbing',
      pointerEvents: 'auto'
    })
    document.body.appendChild(this.widget.el)

    window.addEventListener('mousemove', this.mouseMoveListener)
    window.addEventListener('mouseup', this.mouseUpListener)

    this.widget.applyState(DefaultWidgetStates[type.name] || {})
    this.widget.updatePosition()
  }

  onMouseMove(ev) {
    this.mouseX = ev.clientX
    this.mouseY = ev.clientY
    this.widget.updatePosition()
  }

  onMouseUp(ev) {
    window.removeEventListener('mousemove', this.mouseMoveListener)
    window.removeEventListener('mouseup', this.mouseUpListener)

    const w = this.widget.w * this.grid.scaleX
    const h = this.widget.h * this.grid.scaleY
    const { x, y } = this.grid.pxPosToCoordinates(
      ev.clientX - w / 2,
      ev.clientY - h / 2
    )

    if (
      x > -this.widget.w &&
      y > -this.widget.h &&
      x < this.grid.COLS &&
      y < this.grid.ROWS
    ) {
      this.callback(
        this.widget.constructor.name,
        x,
        y,
        this.widget.w,
        this.widget.h
      )
    }

    document.body.removeChild(this.widget.el)
    this.widget = null
  }

  calculatePxPos(widget) {
    const w = widget.w * this.grid.scaleX
    const h = widget.h * this.grid.scaleY
    return {
      x: this.mouseX - w / 2,
      y: this.mouseY - h / 2,
      w: w,
      h: h
    }
  }
}
