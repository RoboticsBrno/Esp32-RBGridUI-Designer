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

      let props = ''
      for (const [name, prop] of Object.entries(widget.prototype.PROPERTIES)) {
        if (name in genericProps) continue

        const typ = Utils.getCppType(prop, false)
        props += `
        proto.defineProperty("${name}", ff.newFunctionThisVariadic([](jac::ContextRef ctx, jac::ValueWeak thisVal, std::vector<jac::ValueWeak> args) {
            if(args.size() < 1) throw jac::Exception::create(jac::Exception::Type::TypeError, "1 argument expected");
            auto& builder = *GridUiBuilder${wname}::getOpaque(ctx, thisVal);
            builder.${name}(args[0].to<${typ}>());
            return thisVal;
        }), jac::PropFlags::Enumerable);`
      }

      return `#pragma once

#include <jac/machine/functionFactory.h>
#include <gridui.h>

#include "../widgets/${wname.toLowerCase()}.h"

struct GridUiBuilder${wname} : public jac::ProtoBuilder::Opaque<gridui::builder::${wname}>, public jac::ProtoBuilder::Properties {
    static void destroyOpaque(JSRuntime* rt, gridui::builder::${wname}* ptr) noexcept { }

    static void addProperties(JSContext* ctx, jac::Object proto) {
        jac::FunctionFactory ff(ctx);

        ${props}

        proto.defineProperty("finish", ff.newFunctionThisVariadic([](jac::ContextRef ctx, jac::ValueWeak thisVal, std::vector<jac::ValueWeak> args) {
            auto& builder = *GridUiBuilder${wname}::getOpaque(ctx, thisVal);
            return jac::Class<GridUiWidget${wname}>::createInstance(ctx, new gridui::${wname}(std::move(builder.finish())));
        }), jac::PropFlags::Enumerable);
    }
};
`
    },
    generateCodeRuntime(widget) {
      if (widget === null) return ''
      const genericProps = window.Widget.prototype.PROPERTIES

      widget = widget.type
      const wname = widget.name

      let props = ''
      for (const [name, prop] of Object.entries(widget.prototype.PROPERTIES)) {
        if (name in genericProps || !prop.editable) continue

        const typIn = Utils.getCppType(prop, false)

        const nameCapital =
          name.substring(0, 1).toUpperCase() + name.substring(1)
        props += `
        proto.defineProperty("set${nameCapital}", ff.newFunctionThisVariadic([](jac::ContextRef ctx, jac::ValueWeak thisVal, std::vector<jac::ValueWeak> args) {
            if(args.size() < 1) throw jac::Exception::create(jac::Exception::Type::TypeError, "1 argument expected");
            auto& w = *GridUiWidget${wname}::getOpaque(ctx, thisVal);
            w.set${nameCapital}(args[0].to<${typIn}>());
        }), jac::PropFlags::Enumerable);
        proto.defineProperty("${name}", ff.newFunctionThisVariadic([](jac::ContextRef ctx, jac::ValueWeak thisVal, std::vector<jac::ValueWeak> args) {
            auto& w = *GridUiWidget${wname}::getOpaque(ctx, thisVal);
            return w.${name}();
        }), jac::PropFlags::Enumerable);\n`
      }

      return `#pragma once

#include <jac/machine/functionFactory.h>
#include <gridui.h>

struct GridUiWidget${wname} : public jac::ProtoBuilder::Opaque<gridui::${wname}>, public jac::ProtoBuilder::Properties {
    static void addProperties(JSContext* ctx, jac::Object proto) {
        jac::FunctionFactory ff(ctx);
        ${props}
    }
};
`
    },
    generateGridUiMethods() {
      let res = ''

      for (const t of this.widgetTypes) {
        res += `#include "./builder/${t.name.toLowerCase()}.h"\n`
      }

      res += "\n\n"

      for (const t of this.widgetTypes) {
        const nameLower =
          t.name.substring(0, 1).toLowerCase() + t.name.substring(1)

        res += `proto.defineProperty("${nameLower}", ff.newFunctionThisVariadic(std::function(&builder<GridUiBuilder${t.name}, ${t.name}>)), jac::PropFlags::Enumerable);\n`
      }

      res += "\n\n"

      for (const t of this.widgetTypes) {
        res += `jac::Class<GridUiBuilder${t.name}>::init("gui${t.name}Builder");\n`
        res += `jac::Class<GridUiWidget${t.name}>::init("gui${t.name}");\n`
      }

      return res
    },
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
