window.__ModuleLoader__.load({
  id: 'dsh-open-design-preset',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-open-design-preset'
    const API = '/api/open-design-preset'

    const ZH = {
      nav: 'OpenDesign',
      title: 'OpenDesign 技能',
      description: '管理随预设安装的功能技能与设计系统技能。可以单独禁用或启用技能，检查安装是否完整，并查看全局是否已有同名技能。',
      functional: '功能技能',
      design: '设计系统',
      all: '全部',
      search: '搜索技能名或描述',
      onlyGlobal: '只看全局已安装',
      global: '全局已安装',
      enabled: '已启用',
      disabled: '已禁用',
      installOk: '安装检查通过',
      installMissing: '缺少技能',
      install: '安装缺失技能',
      refresh: '刷新',
      loading: '正在读取技能…',
      empty: '没有匹配的技能',
      total: '本地技能',
      enabledCount: '已启用',
      globalCount: '全局同名',
      noDescription: '没有描述',
      toggleFailed: '切换失败',
      installDone: '已安装缺失技能',
      refreshDone: '已刷新',
      skillFunctional: '功能',
      skillDesign: '设计',
    }

    const EN = {
      nav: 'OpenDesign',
      title: 'OpenDesign skills',
      description: 'Manage the functional skills and design systems installed with this preset. Disable or enable individual skills, verify installation, and see which skills are also present globally.',
      functional: 'Functional',
      design: 'Design systems',
      all: 'All',
      search: 'Search name or description',
      onlyGlobal: 'Global only',
      global: 'Global',
      enabled: 'Enabled',
      disabled: 'Disabled',
      installOk: 'Installation check passed',
      installMissing: 'Missing skills',
      install: 'Install missing skills',
      refresh: 'Refresh',
      loading: 'Reading skills…',
      empty: 'No matching skills',
      total: 'Local skills',
      enabledCount: 'Enabled',
      globalCount: 'Global',
      noDescription: 'No description',
      toggleFailed: 'Toggle failed',
      installDone: 'Missing skills installed',
      refreshDone: 'Refreshed',
      skillFunctional: 'Functional',
      skillDesign: 'Design',
    }

    let boundT = (key) => key

    function translator(props) {
      return props !== null && typeof props === 'object' && typeof props.t === 'function'
        ? props.t
        : boundT
    }

    function installStyle() {
      if (typeof document === 'undefined') return () => {}
      const attr = 'data-dsh-open-design-preset'
      if (document.querySelector('style[' + attr + ']') !== null) return () => {}
      const tag = document.createElement('style')
      tag.setAttribute(attr, '')
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
      }
    }

    function request(path, options) {
      return fetch(API + path, {
        credentials: 'same-origin',
        headers: { accept: 'application/json', ...(options && options.body ? { 'content-type': 'application/json' } : {}) },
        ...options,
      }).then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || (payload.roots ? 'request failed' : 'request failed'))
        }
        return payload
      })
    }

    function SettingsSection(props) {
      const t = translator(props)
      const [state, setState] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [message, setMessage] = React.useState('')
      const [query, setQuery] = React.useState('')
      const [tab, setTab] = React.useState('all')
      const [onlyGlobal, setOnlyGlobal] = React.useState(false)
      const [busy, setBusy] = React.useState('')

      const refresh = React.useCallback(() => {
        setLoading(true)
        setError('')
        return request('/state')
          .then((next) => {
            setState(next)
            setMessage('')
          })
          .catch((reason) => setError(String(reason.message || reason)))
          .finally(() => setLoading(false))
      }, [])

      React.useEffect(() => {
        refresh()
      }, [refresh])

      const toggle = (skill) => {
        setBusy(skill.name)
        setMessage('')
        request('/toggle', {
          method: 'POST',
          body: JSON.stringify({ name: skill.name, enabled: !skill.enabled }),
        })
          .then(() => refresh())
          .then(() => setMessage(t('refreshDone')))
          .catch((reason) => setError(String(reason.message || reason)))
          .finally(() => setBusy(''))
      }

      const install = () => {
        setBusy('__install__')
        setMessage('')
        request('/install', { method: 'POST', body: '{}' })
          .then((result) => {
            setMessage(`${t('installDone')} · ${result.total} ${t('total')}`)
            return refresh()
          })
          .catch((reason) => setError(String(reason.message || reason)))
          .finally(() => setBusy(''))
      }

      const skills = state === null ? [] : state.skills
      const filtered = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        return skills.filter((skill) => {
          if (tab !== 'all' && skill.kind !== tab) return false
          if (onlyGlobal && skill.global !== true) return false
          if (needle === '') return true
          return `${skill.name} ${skill.description}`.toLowerCase().includes(needle)
        })
      }, [skills, tab, onlyGlobal, query])

      const missing = state === null
        ? 0
        : state.roots.reduce((sum, root) => sum + root.missing.length, 0)

      return h('div', { className: 'odp' },
        h('div', { className: 'odp-head' },
          h('h2', null, t('title')),
          h('p', null, t('description')),
        ),

        loading && state === null
          ? h('div', { className: 'odp-loading' }, t('loading'))
          : null,

        state !== null
          ? h('div', { className: 'odp-card' },
              h('div', { className: `odp-check ${missing === 0 ? 'is-ok' : 'is-warn'}` },
                h('span', { className: 'odp-check-dot', 'aria-hidden': true }),
                h('div', { className: 'odp-check-main' },
                  h('strong', null, missing === 0 ? t('installOk') : `${t('installMissing')}: ${missing}`),
                  h('span', null, state.roots.map((root) => `${root.label} ${root.installed}/${root.expected}`).join(' · ')),
                ),
                h('button', {
                  type: 'button',
                  className: 'odp-button is-primary',
                  disabled: busy !== '' || missing === 0,
                  onClick: install,
                }, busy === '__install__' ? `${t('install')}…` : t('install')),
              ),
              h('div', { className: 'odp-stats' },
                h('span', { className: 'odp-stat' }, h('strong', null, state.total), t('total')),
                h('span', { className: 'odp-stat' }, h('strong', null, state.enabled), t('enabledCount')),
                h('span', { className: 'odp-stat' }, h('strong', null, state.globalCount), t('globalCount')),
                h('span', { className: 'odp-stat odp-version' }, 'v', state.version),
              ),
              h('div', { className: 'odp-toolbar' },
                h('div', { className: 'odp-tabs', role: 'tablist' },
                  ...[['all', t('all'), state.total], ['functional', t('functional'), state.roots[0].installed], ['design', t('design'), state.roots[1].installed]].map(([id, label, count]) =>
                    h('button', {
                      key: id,
                      type: 'button',
                      role: 'tab',
                      'aria-selected': tab === id,
                      className: `odp-tab ${tab === id ? 'is-active' : ''}`,
                      onClick: () => setTab(id),
                    }, `${label} ${count}`),
                  ),
                ),
                h('div', { className: 'odp-tools' },
                  h('label', { className: 'odp-toggle' },
                    h('input', {
                      type: 'checkbox',
                      checked: onlyGlobal,
                      onChange: (event) => setOnlyGlobal(event.target.checked === true),
                    }),
                    t('onlyGlobal'),
                  ),
                  h('button', {
                    type: 'button',
                    className: 'odp-button',
                    disabled: loading || busy !== '',
                    onClick: () => refresh().then(() => setMessage(t('refreshDone'))),
                  }, loading ? '…' : t('refresh')),
                ),
              ),
              h('input', {
                className: 'odp-search',
                type: 'search',
                value: query,
                placeholder: t('search'),
                'aria-label': t('search'),
                onChange: (event) => setQuery(event.target.value),
              }),
            )
          : null,

        error !== '' ? h('div', { className: 'odp-error' }, error) : null,
        message !== '' ? h('div', { className: 'odp-message' }, message) : null,

        state !== null
          ? h('div', { className: 'odp-list', role: 'list' },
              filtered.length === 0
                ? h('div', { className: 'odp-empty' }, t('empty'))
                : filtered.map((skill) =>
                    h('div', {
                      key: `${skill.kind}:${skill.name}`,
                      className: `odp-row ${skill.enabled ? '' : 'is-disabled'}`,
                      role: 'listitem',
                    },
                      h('div', { className: 'odp-row-main' },
                        h('div', { className: 'odp-row-title' },
                          h('span', { className: 'odp-name' }, skill.name),
                          h('span', { className: `odp-kind is-${skill.kind}` }, skill.kind === 'design' ? t('skillDesign') : t('skillFunctional')),
                          skill.global ? h('span', { className: 'odp-badge' }, t('global')) : null,
                          skill.enabled ? null : h('span', { className: 'odp-badge is-muted' }, t('disabled')),
                        ),
                        h('div', { className: 'odp-desc' }, skill.description || t('noDescription')),
                      ),
                      h('button', {
                        type: 'button',
                        role: 'switch',
                        'aria-checked': skill.enabled,
                        'aria-label': `${skill.name}: ${skill.enabled ? t('enabled') : t('disabled')}`,
                        className: `odp-switch ${skill.enabled ? 'is-on' : ''}`,
                        disabled: busy !== '',
                        onClick: () => toggle(skill),
                      }, h('span', { 'aria-hidden': true })),
                    ),
                  ),
            )
          : null,
      )
    }

    const CSS = `
.odp { color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 13px; }
.odp-head h2 { margin: 0 0 6px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.odp-head p { margin: 0; color: var(--dsw-alias-label-secondary); line-height: 1.55; max-width: 760px; }
.odp-loading { margin-top: 16px; color: var(--dsw-alias-label-secondary); }
.odp-card { margin-top: 16px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); padding: 12px; }
.odp-check { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.odp-check.is-ok { border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 32%, var(--dsw-alias-border-l1)); }
.odp-check.is-warn { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 42%, var(--dsw-alias-border-l1)); }
.odp-check-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--dsw-alias-state-success-primary); }
.odp-check.is-warn .odp-check-dot { background: var(--dsw-alias-state-warn-primary); }
.odp-check-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.odp-check-main strong { font-size: 13px; font-weight: 600; }
.odp-check-main span { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.odp-stats { display: flex; flex-wrap: wrap; gap: 18px; padding: 12px 2px 4px; color: var(--dsw-alias-label-secondary); }
.odp-stat { display: flex; align-items: baseline; gap: 5px; }
.odp-stat strong { color: var(--dsw-alias-label-primary); font-size: 18px; font-weight: 650; }
.odp-version { margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.odp-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 10px; }
.odp-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.odp-tab { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); padding: 5px 9px; border-radius: 6px; font: inherit; font-size: 12px; cursor: pointer; }
.odp-tab.is-active { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.odp-tools { display: flex; align-items: center; gap: 10px; }
.odp-toggle { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 12px; cursor: pointer; }
.odp-toggle input { accent-color: var(--dsw-alias-brand-primary); }
.odp-button { border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); padding: 6px 10px; font: inherit; font-size: 12px; cursor: pointer; }
.odp-button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.odp-button:disabled { opacity: .5; cursor: default; }
.odp-button.is-primary { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); color: #fff; }
.odp-search { width: 100%; box-sizing: border-box; margin-top: 10px; padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; outline: none; }
.odp-search:focus { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }
.odp-list { margin-top: 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: auto; max-height: 56vh; background: var(--dsw-alias-bg-layer-1); }
.odp-row { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.odp-row:last-child { border-bottom: 0; }
.odp-row.is-disabled { opacity: .62; }
.odp-row-main { min-width: 0; flex: 1; }
.odp-row-title { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.odp-name { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; }
.odp-kind { font-size: 10px; line-height: 16px; padding: 0 6px; border-radius: 5px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
.odp-kind.is-design { color: color-mix(in srgb, var(--dsw-alias-brand-primary) 72%, var(--dsw-alias-label-primary)); }
.odp-badge { font-size: 10px; line-height: 16px; padding: 0 6px; border-radius: 5px; color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 11%, transparent); }
.odp-badge.is-muted { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
.odp-desc { margin-top: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.45; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.odp-switch { width: 36px; height: 21px; padding: 2px; border: 0; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); cursor: pointer; flex: none; transition: background .15s ease; }
.odp-switch span { display: block; width: 17px; height: 17px; border-radius: 50%; background: var(--dsw-alias-bg-base); box-shadow: 0 1px 2px rgba(0,0,0,.18); transition: transform .15s ease; }
.odp-switch.is-on { background: var(--dsw-alias-brand-primary); }
.odp-switch.is-on span { transform: translateX(15px); background: #fff; }
.odp-switch:disabled { opacity: .5; cursor: default; }
.odp-empty { padding: 26px; text-align: center; color: var(--dsw-alias-label-secondary); }
.odp-error { margin-top: 10px; padding: 8px 10px; border-radius: 7px; color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent); font-size: 12px; }
.odp-message { margin-top: 10px; color: var(--dsw-alias-state-success-primary); font-size: 12px; }
@media (max-width: 640px) { .odp-check { align-items: flex-start; flex-wrap: wrap; } .odp-check .odp-button { margin-left: 18px; } .odp-toolbar { align-items: flex-start; } .odp-tools { width: 100%; justify-content: space-between; } }
`

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => installStyle(), 'dsh-open-design-preset: styles')
        if (ctx.locale !== undefined && typeof ctx.locale.register === 'function') {
          ctx.effect(() => ctx.locale.register(NS, 'zh', ZH), 'dsh-open-design-preset: zh')
          ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'dsh-open-design-preset: en')
          boundT = ctx.locale.bind(NS)
        }
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'open-design',
          order: 13,
          label: () => boundT('nav'),
          locale: NS,
        }, SettingsSection)), 'dsh-open-design-preset: settings section')
      },
    }
  },
})
