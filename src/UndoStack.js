class UndoOperation {
  undo() {
    throw new Error('Not implemented')
  }

  redo() {
    throw new Error('Not implemented')
  }
}

export class DeleteWidget extends UndoOperation {
  constructor(grid, widget) {
    super()
    this.grid = grid
    this.widget = widget
  }

  undo() {
    this.grid.addWidgetConstructed(this.widget)
  }

  redo() {
    this.grid.removeWidget(this.widget)
  }
}

export class AddWidget extends UndoOperation {
  constructor(grid, widget) {
    super()
    this.grid = grid
    this.widget = widget
  }

  undo() {
    this.grid.removeWidget(this.widget)
  }

  redo() {
    this.grid.addWidgetConstructed(this.widget)
  }
}

export class MoveWidget extends UndoOperation {
  constructor(widget, origPos) {
    super()
    this.widget = widget
    this.newPos = widget.pos()
    this.origPos = origPos
  }

  undo() {
    this.widget.applyState(this.origPos)
  }

  redo() {
    this.widget.applyState(this.newPos)
  }
}

export class UndoStack {
  constructor() {
    this.stack = []
    this.currentIdx = 0
  }

  push(...operations) {
    if (operations.length === 0) return

    this.stack.splice(
      this.currentIdx,
      this.stack.length - this.currentIdx,
      operations
    )
    this.currentIdx = this.stack.length
    for (const op of operations) {
      op.redo()
    }
  }

  redo() {
    if (this.currentIdx === this.stack.length) return
    for (const op of this.stack[this.currentIdx]) {
      op.redo()
    }
    ++this.currentIdx
  }

  undo() {
    if (this.currentIdx === 0) return
    --this.currentIdx
    for (const op of this.stack[this.currentIdx]) {
      op.undo()
    }
  }
}
