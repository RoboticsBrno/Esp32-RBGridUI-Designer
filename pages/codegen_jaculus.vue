<template>
  <div class="white layout-container d-flex justify-space-between pa-1">
    <v-card width="200px" class="flex-shrink-0 me-2">
      <v-btn
        block
        color="secondary"
        class="justify-start"
        large
        :text="selectedWidget !== null"
        @click="selectedWidget = null"
      >
        gridui.h methods
      </v-btn>

      <v-btn
        block
        color="secondary"
        class="justify-start"
        large
        text
        @click="onDownloadClick"
      >
        Download zip
      </v-btn>

      <v-card-title>Widgets</v-card-title>
      <v-btn
        v-for="t in widgetTypes"
        :key="t.name"
        block
        color="primary"
        class="justify-start"
        large
        :text="t !== selectedWidget"
        @click="selectedWidget = t"
      >
        {{ t.name }}
      </v-btn>
    </v-card>
    <code-display
      :value="generateCodeBuilder(selectedWidget)"
      language="cpp"
      title="Builder"
      class="me-1"
    />
    <code-display
      :value="generateCodeRuntime(selectedWidget)"
      :language="!selectedWidget ? 'typescript' : 'cpp'"
      title="Runtime"
      class="ms-1"
    />
  </div>
</template>

<script>
import JSZip from 'jszip'
import CodeDisplay from '~/components/CodeDisplay'
import * as Utils from '~/src/layoutgen/Common'

import '~/gridui/web/js/01_header'
import '~/gridui/web/js/05_widget'
import '~/gridui/web/js/07_grid'

const req = require.context('~/gridui/web/js/widgets', true, /\.js$/)
req.keys().forEach((key) => req(key))

// src/widgets/widget.h
const RUNTIME_WIDGET_PROPS = {
  uuid: { type: Number, editable: false },
  widgetX: { type: Number },
  widgetY: { type: Number },
  widgetW: { type: Number },
  widgetH: { type: Number },
  widgetTab: { type: Number }
  // "css": true, - more complex
}

const EXTRA_RUNTIME_PROPS = {
  Arm: {
    x: { type: Number, editable: false },
    y: { type: Number, editable: false }
  },
  Button: {
    pressed: { type: Boolean, editable: false }
  },
  Joystick: {
    x: { type: Number, editable: false },
    y: { type: Number, editable: false }
  },
  Orientation: {
    yaw: { type: Number, editable: false },
    pitch: { type: Number, editable: false },
    roll: { type: Number, editable: false },
    joystickX: { type: Number, editable: false },
    joystickY: { type: Number, editable: false }
  }
}

export default {
  components: {
    CodeDisplay
  },
  data() {
    let types = []
    if (process.client && window.Widget) {
      types = window.Widget.SUBCLASSES.map((w) => {
        return {
          name: w.name,
          type: w
        }
      })
      types.push({
        name: 'Widget',
        type: window.Widget
      })
    }
    return {
      widgetTypes: types,
      selectedWidget: types[0]
    }
  },
  methods: {
    generateCodeBuilder(widget) {
      if (widget === null) {
        return this.generateGridUiMethods()
      }

      if (widget.name === 'Widget') {
        return ''
      }

      widget = widget.type
      const wname = widget.name

      const genericProps = window.Widget.prototype.PROPERTIES

      let builderMethods = ''
      let builderProps = ''
      for (const [name, prop] of Object.entries(widget.prototype.PROPERTIES)) {
        if (name in genericProps) continue

        const typ = Utils.getCppType(prop, false)
        builderMethods += `
    static JSValue ${name}(JSContext* ctx_, JSValueConst thisVal, int argc, JSValueConst* argv) {
        auto& builder = builderOpaque<gridui::builder::${wname}>(thisVal);
        builder.${name}(jac::ValueWeak(ctx_, argv[0]).to<${typ}>());
        return JS_DupValue(ctx_, thisVal);
    }
`
        builderProps += `
        if(name == "${name}") return ${name};`
      }

      if (Object.entries(widget.prototype.EVENTS).length !== 0) {
        builderProps += `\n`
        for (const [, methodName] of Object.entries(widget.prototype.EVENTS)) {
          builderProps += `\n        if(name == "${methodName}") return &builderCallbackImpl<builder::${wname}, ${wname}, &builder::${wname}::${methodName}>;`
        }
      }

      return `#pragma once

#include <jac/machine/functionFactory.h>
#include <gridui.h>

#include "../widgets/_common.h"

namespace gridui_jac {

class ${wname}Builder {${builderMethods}
public:
    static JSCFunction *getPropFunc(const AtomString& name) {
        using namespace gridui;

        if(name == "css") return builderCss<builder::${wname}>;
        if(name == "finish") return builderFinish<WidgetTypeId::${wname}, builder::${wname}, ${wname}>;
${builderProps}

        return nullptr;
    }
};

};
`
    },
    generateRuntimeProps(wname, properties, ignoreGeneric) {
      const genericProps = window.Widget.prototype.PROPERTIES

      let widgetMethods = ''
      let widgetProps = ''
      for (const [name, prop] of Object.entries(properties)) {
        if (ignoreGeneric !== false && name in genericProps) continue

        const typIn = Utils.getCppType(prop, false)

        if (prop.editable !== false) {
          const setName =
            'set' + name.substring(0, 1).toUpperCase() + name.substring(1)

          widgetProps += `
        if(name == "${name}") {
            *getter = ${name};
            *setter = ${setName};
            return;
        }`

          widgetMethods += `
    static JSValue ${setName}(JSContext* ctx_, JSValueConst thisVal, JSValueConst val) {
        auto& widget = widgetOpaque<gridui::${wname}>(thisVal);
        widget.${setName}(jac::ValueWeak(ctx_, val).to<${typIn}>());
        return JS_UNDEFINED;
    }`
        } else {
          widgetProps += `
        if(name == "${name}") {
            *getter = ${name};
            return;
        }`
        }

        widgetMethods += `
    static JSValue ${name}(JSContext* ctx_, JSValueConst thisVal) {
        auto& widget = widgetOpaque<gridui::${wname}>(thisVal);
        return jac::Value::from(ctx_, widget.${name}()).loot().second;
    }
`
      }
      return [widgetMethods, widgetProps]
    },
    generateCodeRuntime(widget) {
      if (widget === null) return this.generateDTsFile()

      const wname = widget.name
      if (wname === 'Widget') {
        widget = {
          prototype: {
            PROPERTIES: RUNTIME_WIDGET_PROPS
          }
        }
      } else {
        widget = widget.type
      }

      let [widgetMethods, widgetProps] = this.generateRuntimeProps(
        wname,
        widget.prototype.PROPERTIES
      )

      const [extraMethods, extraProps] = this.generateRuntimeProps(
        wname,
        EXTRA_RUNTIME_PROPS[wname] || {},
        false
      )
      widgetMethods += extraMethods
      widgetProps += extraProps

      return `#pragma once

#include <jac/machine/functionFactory.h>
#include <gridui.h>
#include "./_common.h"

namespace gridui_jac {

class ${wname}Widget {${widgetMethods}
public:
    static void getProperty(const AtomString& name, qjsGetter* getter, qjsSetter *setter) {${widgetProps}
    }
};

};
`
    },
    generateGridUiMethods() {
      let res = ''

      for (const t of this.widgetTypes) {
        res += `#include "./builder/${t.name.toLowerCase()}.h"\n`
      }

      for (const t of this.widgetTypes) {
        res += `#include "./widgets/${t.name.toLowerCase()}.h"\n`
      }

      for (const t of this.widgetTypes) {
        res += `${t.name}\n`
      }

      res += '\n\n'

      for (const t of this.widgetTypes) {
        if (t.name === 'Widget') continue

        const nameLower =
          t.name.substring(0, 1).toLowerCase() + t.name.substring(1)

        res += `proto.defineProperty("${nameLower}", ff.newFunctionThisVariadic(std::function(&builder<gridui::builder::${t.name}, gridui::${t.name}>)), jac::PropFlags::Enumerable);\n`
      }

      res += '\n\n'

      let elseStr = ''
      for (const t of this.widgetTypes) {
        if (t.name === 'Widget') continue

        res += `${elseStr}if(literalEqual(wName, wNameLen, "${t.name}")) getFunc = ${t.name}Builder::getPropFunc(propName);\n`
        elseStr = 'else '
      }

      res += '\n\n'

      for (const t of this.widgetTypes) {
        if (t.name === 'Widget') continue

        res += `case WidgetTypeId::${t.name}: ${t.name}Widget::getProperty(propName, &getter, &setter); break;\n`
      }

      res += '\n\n'

      return res
    },
    generateDTsFile() {
      const genericProps = window.Widget.prototype.PROPERTIES

      let baseProps = ''

      for (const [name, info] of Object.entries(RUNTIME_WIDGET_PROPS)) {
        const typ = Utils.getTsType(info, false)
        if (info.editable === false) {
          baseProps += `\n          readonly ${name}: ${typ}`
        } else {
          baseProps += `\n          ${name}: ${typ}`
        }
      }

      let builderMethods = ''
      let builderInterfaces = ''
      let widgetInterfaces = ''

      for (const t of this.widgetTypes) {
        if (t.name === 'Widget') {
          continue
        }

        const nameLower =
          t.name.substring(0, 1).toLowerCase() + t.name.substring(1)

        builderInterfaces += `\n        interface ${t.name} extends Base {`
        widgetInterfaces += `\n        interface ${t.name} extends Base {`

        for (const [name, prop] of Object.entries(
          t.type.prototype.PROPERTIES
        )) {
          if (name in genericProps) continue

          const typ = Utils.getTsType(prop, false)

          builderInterfaces += `\n            ${name}(${name}: ${typ}): ${t.name}`
          if (prop.editable) {
            widgetInterfaces += `\n            ${name}: ${typ}`
          }
        }

        for (const [name, prop] of Object.entries(
          EXTRA_RUNTIME_PROPS[t.name] || {}
        )) {
          const typ = Utils.getTsType(prop, false)
          if (prop.editable !== false) {
            widgetInterfaces += `\n            ${name}: ${typ}`
          } else {
            widgetInterfaces += `\n            readonly ${name}: ${typ}`
          }
        }

        if (Object.entries(t.type.prototype.EVENTS || {}).length !== 0) {
          builderInterfaces += `\n`
          for (const [, methodName] of Object.entries(
            t.type.prototype.EVENTS
          )) {
            builderInterfaces += `\n            ${methodName}(callback: (${nameLower}: widget.${t.name}) => void): ${t.name}`
          }
        }

        builderInterfaces += `\n\n            finish(): widget.${t.name}`

        builderInterfaces += '\n        }\n'
        widgetInterfaces += '\n        }\n'

        builderMethods += `\n        ${nameLower}(x: number, y: number, w: number, h: number, uuid?: number, tab?: number): builder.${t.name}`
      }

      return `declare module "gridui" {
    namespace widget {
        interface Base {${baseProps}
          css(key: string): string
          setCss(key: string, value: string): void
        }
      ${widgetInterfaces}    }

    namespace builder {
        interface Base {
            css(key: string, value: string): this
        }
${builderInterfaces}    }

    class Builder {${builderMethods}
    }

    /**
     * Initialize GridUI.
     * @param ownerName name of the owner, must match the name entered in RBController app.
     * @param deviceName name of this device, visible in the RBController app.
     * @param builderCallback callback, which receives the builder instance that can be used to create widgets.
     */
    function begin(ownerName: string, deviceName: string, builderCallback: (builder: Builder) => void): void

    /**
     * Stop GridUI.
     */
    function end(): void

    /**
     * Set current tab index
     */
    function changeTab(index: number): void

    /**
     * Send a message to the integrated terminal at the top of the UI.
     */
    function log(message: string): void

    /**
     * Returns included GridUI version as number, to be compared with hex representation of the version.
     * 
     * For example, for version 5.1.0, do: \`gridui.version() >= 0x050100\`
     */
    function version(): number
}
`
    },
    convertToRbJsonValue(name, prop) {
      switch (prop.type) {
        case Boolean:
          return `new rbjson::Bool(${name})`
        default:
          return name
      }
    },
    async onDownloadClick() {
      const zip = new JSZip()

      for (const t of this.widgetTypes) {
        let filename = t.name.toLowerCase() + '.h'
        if (t.name === 'Widget') {
          filename = 'base.h'
        }

        const builderFile = this.generateCodeBuilder(t)
        if (builderFile) {
          zip.file(`builder/${filename}`, builderFile)
        }

        const widgetFile = this.generateCodeRuntime(t)
        if (widgetFile) {
          zip.file(`widgets/${filename}`, widgetFile)
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' })

      const element = document.createElement('a')
      element.setAttribute('href', window.URL.createObjectURL(blob))
      element.setAttribute('download', 'gridui_generated.zip')
      element.style.display = 'none'
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    }
  }
}
</script>

<style lang="scss" scoped>
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
</style>
