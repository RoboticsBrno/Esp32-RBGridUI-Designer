import deepEqual from 'deep-equal'

export function getPropertyValue(widget, name, prop) {
  if (prop === undefined) {
    const proto = Object.getPrototypeOf(widget)

    prop = proto.PROPERTIES[name]
    if (!prop) return undefined
  }

  if (prop.get === undefined) {
    return prop.type(widget[name])
  } else {
    return prop.get.call(widget)
  }
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

export function getCppType(prop, isInputArg) {
  switch (prop.type) {
    case String:
      return isInputArg === true ? 'const std::string&' : 'std::string'
    case Number:
      return 'float'
    case Boolean:
      return 'bool'
    case Object:
      return 'std::unique_ptr<rbjson::Object>'
    default:
      return 'void* /* TODO: fix type */'
  }
}

export function getRbJsonType(prop) {
  switch (prop.type) {
    case String:
    case Number:
      return prop.type.name
    case Boolean:
      return 'Bool'
    default:
      return 'Nil/* TODO: fix type */'
  }
}
