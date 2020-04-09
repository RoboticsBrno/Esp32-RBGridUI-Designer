import * as Common from './Common'

function processWidget(widget, isSelected) {
  const type = widget.constructor.name
  const proto = Object.getPrototypeOf(widget)

  let res = `UI.${type.toLowerCase()}(`

  const coordNames = ['x', 'y', 'w', 'h']
  res += coordNames.map((n) => Common.getPropertyValue(widget, n)).join(', ')

  if (type === 'Arm') {
    res += `, rkArmGetInfo()`
  } else {
    const mainValue = Common.getMainPropertyValue(widget)
    if (mainValue !== undefined) {
      res += `, ${Common.formatValue(mainValue)}`
    }
  }

  if (isSelected) {
    res += ') // <-- selected\n'
  } else {
    res += ')\n'
  }

  for (const [name, prop] of Object.entries(proto.PROPERTIES)) {
    if (prop.ignoreInBuilder || prop.main) continue

    if (Common.isDefaultPropValue(widget, name, prop)) continue

    const val = Common.getPropertyValue(widget, name, prop)
    res += Common.formatProperty(name, val, '    ')
  }

  res += `    .finish();\n\n`
  return res
}

export default function(widgets, selectedWidgets) {
  let res = ''
  for (const w of widgets) {
    res += processWidget(w, selectedWidgets.includes(w))
  }
  return res
}
