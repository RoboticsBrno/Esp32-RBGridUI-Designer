import deepEqual from 'deep-equal'

export function getPropertyValue(widget, name, prop) {
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

export function getMainPropertyValue(widget) {
  const proto = Object.getPrototypeOf(widget)
  for (const [name, prop] of Object.entries(proto.PROPERTIES)) {
    if (prop.main) {
      return getPropertyValue(widget, name, prop)
    }
  }
  return undefined
}

export function isDefaultPropValue(widget, name, prop) {
  const tempWidget = new window[widget.constructor.name](this, 0)

  const our = getPropertyValue(widget, name, prop)
  const def = getPropertyValue(tempWidget, name, prop)
  return deepEqual(our, def, { strict: true })
}

export function formatValue(value) {
  if (typeof value === 'string') {
    value = value.replace(/\\/g, `\\\\`).replace(/"/g, `\\"`)
    return `"${value}"`
  }
  return value.toString()
}

export function formatProperty(name, value, indent) {
  if (!(value instanceof Object)) {
    return `${indent}.${name}(${formatValue(value)})\n`
  }

  let res = ''
  for (const [k, v] of Object.entries(value)) {
    res += `${indent}.${name}(${formatValue(k)}, ${formatValue(v)})\n`
  }
  return res
}
