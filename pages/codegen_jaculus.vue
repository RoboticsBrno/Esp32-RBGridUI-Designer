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
      language="cpp"
      title="Runtime"
      class="ms-1"
    />
  </div>
</template>

<script>
import CodeDisplay from '~/components/CodeDisplay'
import * as Utils from '~/src/cppgenerator/Common'

import '~/gridui/web/js/00_header'
import '~/gridui/web/js/05_widget'
import '~/gridui/web/js/07_grid'

const req = require.context('~/gridui/web/js/widgets', true, /\.js$/)
req.keys().forEach((key) => req(key))
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

      widget = widget.type
      const wname = widget.name

      const genericProps = window.Widget.prototype.PROPERTIES

      let builderMethods = ""
      let builderProps = ""
      for (const [name, prop] of Object.entries(widget.prototype.PROPERTIES)) {
        if (name in genericProps) continue

        const typ = Utils.getCppType(prop, false)
        builderMethods += `
    static JSValue ${name}(JSContext* ctx_, JSValueConst thisVal, int argc, JSValueConst* argv) {
        auto& builder = *reinterpret_cast<gridui::builder::${wname}*>(JS_GetOpaque(thisVal, 1));
        builder.${name}(jac::ValueWeak(ctx_, argv[0]).to<${typ}>());
        return JS_DupValue(ctx_, thisVal);
    }
`
        builderProps += `
        proto.set("${name}", jac::Value(ctx, JS_NewCFunction(ctx, ${name}, "${name}", 1)));`
      }

      return `#pragma once

#include <jac/machine/functionFactory.h>
#include <gridui.h>

namespace gridui_jac {

class ${wname}Builder {${builderMethods}
public:
    static jac::Object proto(jac::ContextRef ctx) {
        auto proto = jac::Object::create(ctx);${builderProps}
        return proto;
    }
};

};
`
    },
    generateCodeRuntime(widget) {
      if (widget === null) return ''
      const genericProps = window.Widget.prototype.PROPERTIES

      widget = widget.type
      const wname = widget.name

      let widgetMethods = ""
      let widgetProps = ""
      for (const [name, prop] of Object.entries(widget.prototype.PROPERTIES)) {
        if (name in genericProps || !prop.editable) continue

        const typIn = Utils.getCppType(prop, false)

        const setName = "set" + name.substring(0, 1).toUpperCase() + name.substring(1)
        
        widgetMethods += `
    static JSValue ${setName}(JSContext* ctx_, JSValueConst thisVal, JSValueConst val) {
        auto& widget = *reinterpret_cast<gridui::${wname}*>(JS_GetOpaque(thisVal, 1));
        widget.${setName}(jac::ValueWeak(ctx_, val).to<${typIn}>());
        return JS_UNDEFINED;
    }
    static JSValue ${name}(JSContext* ctx_, JSValueConst thisVal) {
        auto& widget = *reinterpret_cast<gridui::${wname}*>(JS_GetOpaque(thisVal, 1));
        return jac::Value::from(ctx_, widget.${name}()).loot().second;
    }
`
        widgetProps += `\n        defineWidgetProperty(ctx, proto, "${name}", "${setName}", ${name}, ${setName});`
      }

      return `#pragma once

#include <jac/machine/functionFactory.h>
#include <gridui.h>
#include "./_common.h"

namespace gridui_jac {

class ${wname}Widget {${widgetMethods}
public:
    static jac::Object proto(jac::ContextRef ctx) {
        auto proto = jac::Object::create(ctx);${widgetProps}
        return proto;
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

      res += "\n\n"

      let id = 1;
      for (const t of this.widgetTypes) {
        const nameLower =
          t.name.substring(0, 1).toLowerCase() + t.name.substring(1)

        res += `proto.defineProperty("${nameLower}", ff.newFunctionThisVariadic(std::function(&builder<${id}, gridui::builder::${t.name}, gridui::${t.name}, ${t.name}Builder::proto, ${t.name}Widget::proto>)), jac::PropFlags::Enumerable);\n`
        id++;
      }

      res += "\n\n"

      return res
    },
    generateDTsFile() {
      const genericProps = window.Widget.prototype.PROPERTIES

      let builderMethods = ''

      for (const t of this.widgetTypes) {
        const nameLower =
          t.name.substring(0, 1).toLowerCase() + t.name.substring(1)

          for (const [name, prop] of Object.entries(widget.prototype.PROPERTIES)) {
            if (name in genericProps) continue

            const typ = Utils.getCppType(prop, false)
          }

          builderMethods += `\n        ${nameLower}(x: number, y: number, w: number, h: number, uuid?: number, tab?: number): builder.${t.name};`
      }

      return `declare module "gridui" {
    namespace widget {
        interface Button {
            color: string
        }
    }

    namespace builder {
        interface Button {
            text(text: string): Button;
            finish(): widget.Button;
        }
    }

    class Builder {${builderMethods}
    }

    /**
     * Initialize GridUI.
     * @param ownerName name of the owner, must match the name entered in RBController app.
     * @param deviceName name of this device, visible in the RBController app.
     * @param builderCallback callback, which receives the builder instance that can be used to create widgets.
     */
    function begin(ownerName: string, deviceName: string, builderCallback: (builder: Builder) => void): void;

    /**
     * Stop GridUI.
     */
    function end(): void;
}
`
    }
    convertToRbJsonValue(name, prop) {
      switch (prop.type) {
        case Boolean:
          return `new rbjson::Bool(${name})`
        default:
          return name
      }
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
