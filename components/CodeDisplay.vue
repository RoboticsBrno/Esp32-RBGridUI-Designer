<template>
  <div class="d-flex flex-column fill">
    <v-row dense align="center" class="flex-grow-0">
      <v-col class="mx-4 my-2 title shrink text-no-wrap">
        {{ title }}
      </v-col>
      <v-col v-if="hideable" cols="2">
        <v-btn
          text
          block
          color="accent"
          @click="showCode = !showCode"
          v-text="showCode ? 'Hide' : 'Show'"
        ></v-btn>
      </v-col>
      <v-spacer />
      <v-col v-if="showCode" class="shrink">
        <v-btn text color="primary" @click="onCopyClick">
          Copy to clipboard
        </v-btn>
      </v-col>
    </v-row>
    <div v-show="showCode" class="flex-grow-1" style="overflow:hidden;">
      <pre
        style="overflow: auto; height: 100%; font-size: 12px"
      ><code :class="[ `language-${language}`, 'pb-4' ]" v-html="highlighted"></code></pre>
    </div>
  </div>
</template>

<script>
// import base style
import Prism from 'prismjs'
import 'prismjs/themes/prism-okaidia.css'
import 'prismjs/components/prism-javascript.js'
import 'prismjs/components/prism-clike.js'
import 'prismjs/components/prism-c.js'
import 'prismjs/components/prism-cpp.js'

import copy from 'copy-to-clipboard'

export default {
  props: {
    value: {
      type: String,
      required: true
    },
    language: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    hideable: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data() {
    return {
      showCode: !this.hideable
    }
  },
  computed: {
    highlighted() {
      return Prism.highlight(
        this.value,
        Prism.languages[this.language],
        this.language
      )
    }
  },
  methods: {
    onCopyClick() {
      copy(this.value)
      this.$notify({
        group: 'info',
        title: 'Code copied',
        text: 'The code was copied into your clipboard.'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.fill {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

code {
  box-shadow: unset;
  border-radius: 0px;

  &:before {
    content: '';
  }
}
pre {
  border-radius: 0px;
}
</style>
