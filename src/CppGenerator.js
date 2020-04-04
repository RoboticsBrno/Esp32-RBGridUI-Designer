import deepEqual from 'deep-equal'

function getPropertyValue(widget, name, prop) {
  if (prop === undefined) {
    const proto = Object.getPrototypeOf(widget)

    prop = proto.PROPERTIES[name]
    if (!prop) return undefined
  }

  if (prop.get === undefined) {
    if (prop.types.length === 1) {
      return prop.types[0](widget[name])
    } else {
      return widget[name]
    }
  } else {
    return prop.get.call(widget)
  }
}

function getMainPropertyValue(widget) {
  const proto = Object.getPrototypeOf(widget)
  for (const [name, prop] of Object.entries(proto.PROPERTIES)) {
    if (prop.main) {
      return getPropertyValue(widget, name, prop)
    }
  }
  return undefined
}

function isDefaultPropValue(widget, name, prop) {
  const tempWidget = new window[widget.constructor.name](this, 0)

  const our = getPropertyValue(widget, name, prop)
  const def = getPropertyValue(tempWidget, name, prop)
  return deepEqual(our, def, { strict: true })
}

function formatValue(value) {
  if (typeof value === 'string') {
    value = value.replace(/\\/g, `\\\\`).replace(/"/g, `\\"`)
    return `"${value}"`
  }
  return value.toString()
}

function formatProperty(name, value) {
  if (!(value instanceof Object)) {
    return `    .${name}(${formatValue(value)})\n`
  }

  let res = ''
  for (const [k, v] of Object.entries(value)) {
    res += `    .${name}(${formatValue(k)}, ${formatValue(v)})\n`
  }
  return res
}

function processWidget(widget, isSelected) {
  const type = widget.constructor.name
  const proto = Object.getPrototypeOf(widget)

  let res = `UI.${type.toLowerCase()}(`

  const coordNames = ['x', 'y', 'w', 'h']
  res += coordNames.map((n) => getPropertyValue(widget, n)).join(', ')

  if (type === 'Arm') {
    res += `, rkArmGetInfo()`
  } else {
    const mainValue = getMainPropertyValue(widget)
    if (mainValue !== undefined) {
      res += `, ${formatValue(mainValue)}`
    }
  }

  if (isSelected) {
    res += ') // <-- selected\n'
  } else {
    res += ')\n'
  }

  for (const [name, prop] of Object.entries(proto.PROPERTIES)) {
    if (coordNames.includes(name) || prop.main) continue

    if (isDefaultPropValue(widget, name, prop)) continue

    const val = getPropertyValue(widget, name, prop)
    res += formatProperty(name, val)
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
