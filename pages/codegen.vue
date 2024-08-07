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
import * as Utils from '~/src/layoutgen/Common'

import '~/gridui/web/js/01_header'
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

        const typ = Utils.getCppType(prop, true)
        props += `
    ${wname}& ${name}(${typ} ${name}) {
        extra().set("${name}", ${this.convertToRbJsonValue(name, prop)});
        return *this;
    }\n`
      }

      return `#pragma once

#include "../widgets/${wname.toLowerCase()}.h"
#include "widget.h"

namespace gridui {
namespace builder {

/** @ingroup widgets_builder
*/
class ${wname} : public Widget, public BuilderMixin<${wname}, gridui::${wname}> {
    static const char* name() { return "${wname}"; }

    friend class gridui::_GridUi;
    using Widget::Widget;

public:${props}
};

};
};`
    },
    generateCodeRuntime(widget) {
      if (widget === null) return ''
      const genericProps = window.Widget.prototype.PROPERTIES

      widget = widget.type
      const wname = widget.name

      let props = ''
      for (const [name, prop] of Object.entries(widget.prototype.PROPERTIES)) {
        if (name in genericProps || !prop.editable) continue

        const typIn = Utils.getCppType(prop, true)
        const typOut = Utils.getCppType(prop, false)
        const typRbJson = Utils.getRbJsonType(prop)
        const typRbJsonGetter = typRbJson === 'Number' ? 'Double' : typRbJson

        const nameCapital =
          name.substring(0, 1).toUpperCase() + name.substring(1)
        props += `
    void set${nameCapital}(${typIn} ${name}) {
        m_state->set("${name}", new rbjson::${typRbJson}(${name}));
    }

    ${typOut} ${name}() const {
        return data().get${typRbJsonGetter}("${name}");
    }\n`
      }

      return `#pragma once

#include "widget.h"

namespace gridui {

/** @ingroup widgets_constructed
*/
class ${wname} : public Widget {
    template <typename Self, typename Finished>
    friend class builder::BuilderMixin;

    using Widget::Widget;

public:${props}
};

};
`
    },
    generateGridUiMethods() {
      let res = ''
      for (const t of this.widgetTypes) {
        const nameLower =
          t.name.substring(0, 1).toLowerCase() + t.name.substring(1)

        res += `
    builder::${t.name}& ${nameLower}(float x, float y, float w, float h, uint16_t uuid = 0, uint16_t tab = 0) {
        return *newWidget<builder::${t.name}>(x, y, w, h, uuid, tab);
    }\n`
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
