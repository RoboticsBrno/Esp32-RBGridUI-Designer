const clone = require('rfdc')()

class UndoOperation {
  constructor(grid) {
    this.grid = grid
  }

  undo() {
    throw new Error('Not implemented')
  }

  redo() {
    throw new Error('Not implemented')
  }
}

export class DeleteWidget extends UndoOperation {
  constructor(grid, widget) {
    super(grid)
    this.uuid = widget.uuid
    this.type = widget.constructor.name
    this.state = null
  }

  undo() {
    if (this.state !== null) {
      this.grid.addWidget(this.uuid, this.type, this.state)
      this.state = null
    }
  }

  redo() {
    const w = this.grid.getWidgetByUuid(this.uuid)
    if (w === null) return
    this.state = w.getState()
    this.grid.removeWidget(w)
  }
}

export class AddWidget extends DeleteWidget {
  constructor(grid, uuid, type, state) {
    super(grid, {})
    this.uuid = uuid
    this.type = type
    this.state = state
  }

  undo() {
    super.redo()
  }

  redo() {
    super.undo()
  }
}

export class MoveWidget extends UndoOperation {
  constructor(grid, widget, origPos) {
    super(grid)
    this.uuid = widget.uuid
    this.newPos = widget.pos()
    this.origPos = origPos
  }

  undo() {
    const w = this.grid.getWidgetByUuid(this.uuid)
    if (w !== null) {
      w.applyState(this.origPos)
    }
  }

  redo() {
    const w = this.grid.getWidgetByUuid(this.uuid)
    if (w !== null) {
      w.applyState(this.newPos)
    }
  }
}

export class ChangeProperty extends UndoOperation {
  constructor(grid, widget, name, original, newer) {
    super(grid)
    this.uuid = widget.uuid
    this.name = name
    this.original = clone(original)
    this.newer = clone(newer)
  }

  undo() {
    const w = this.grid.getWidgetByUuid(this.uuid)
    if (w !== null) {
      w.applyState(Object.fromEntries([[this.name, this.original]]))
    }
  }

  redo() {
    const w = this.grid.getWidgetByUuid(this.uuid)
    if (w !== null) {
      w.applyState(Object.fromEntries([[this.name, this.newer]]))
    }
  }
}

export class ReplaceLayout extends UndoOperation {
  constructor(grid, original, newer) {
    super()
    this.grid = grid
    this.original = original
    this.newer = newer
  }

  undo() {
    this.grid.reset(this.original)
  }

  redo() {
    this.grid.reset(this.newer)
  }
}

export class SetTabCount extends UndoOperation {
  constructor(designer, grid, origTabCount, newTabCount) {
    super()
    this.designer = designer
    this.grid = grid
    this.origTabCount = origTabCount
    this.newTabCount = newTabCount
    this.widgetDeletes = []
  }

  undo() {
    this.setCount(this.newTabCount, this.origTabCount)
  }

  redo() {
    this.setCount(this.origTabCount, this.newTabCount)
  }

  setCount(before, after) {
    if (before > after) {
      this.widgetDeletes = this.grid.widgets
        .filter((w) => w.tab === before - 1)
        .map((w) => new DeleteWidget(this.grid, w))
      this.widgetDeletes.forEach((d) => d.redo())
    }

    this.grid.setTabCount(after)
    this.designer.tabsCount = after
    this.designer.activeTab = this.grid.currentTabIdx

    if (before < after) {
      for (const d of this.widgetDeletes) {
        d.undo()
      }
      this.widgetDeletes = []
    }
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

    if (this.stack.length > 64) {
      this.stack.shift()
    }

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

  canUndo() {
    return this.currentIdx > 0
  }

  canRedo() {
    return this.currentIdx < this.stack.length
  }

  clear() {
    this.currentIdx = 0
    this.stack = []
  }
}
