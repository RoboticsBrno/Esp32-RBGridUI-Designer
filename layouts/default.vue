<template>
  <v-app light>
    <v-main class="blue-grey lighten-4">
      <client-only>
        <nuxt />
      </client-only>
      <notifications
        group="info"
        type="info"
        position="bottom right"
        class="ma-6"
      />
      <notifications
        group="warn"
        type="warn"
        position="bottom right"
        :classes="['vue-notification', 'warn']"
        class="ma-6"
      />
      <notifications
        group="error"
        type="error"
        :classes="['vue-notification', 'error']"
        position="bottom right"
        class="ma-6"
      />
      <notifications
        group="success"
        type="success"
        :classes="['vue-notification', 'success']"
        position="bottom right"
        class="ma-6"
      />
    </v-main>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      clipped: false,
      drawer: false,
      fixed: false,
      items: [
        {
          icon: 'mdi-apps',
          title: 'Welcome',
          to: '/'
        },
        {
          icon: 'mdi-chart-bubble',
          title: 'Inspire',
          to: '/inspire'
        }
      ],
      miniVariant: false,
      right: true,
      rightDrawer: false,
      title: 'Vuetify.js'
    }
  }
}
</script>
