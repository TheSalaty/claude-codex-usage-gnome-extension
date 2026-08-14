import Gio from 'gi://Gio'
import GLib from 'gi://GLib'
import System from 'system'

const BUTTON_LEFT = 272
const OUT_DIR = '/tmp/aiu-shots'

const bus = Gio.DBus.session

const call = (name, objectPath, iface, method, params) =>
  bus.call_sync(name, objectPath, iface, method, params, null, Gio.DBusCallFlags.NONE, 10_000, null)

const getProperty = (name, objectPath, iface, property) =>
  call(name, objectPath, 'org.freedesktop.DBus.Properties', 'Get', new GLib.Variant('(ss)', [iface, property]))
    .get_child_value(0)
    .get_variant()

const sleep = (seconds) => {
  const loop = new GLib.MainLoop(null, false)
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.round(seconds * 1000), () => {
    loop.quit()
    return GLib.SOURCE_REMOVE
  })
  loop.run()
}

const firstMonitorConnector = () => {
  const state = call(
    'org.gnome.Mutter.DisplayConfig',
    '/org/gnome/Mutter/DisplayConfig',
    'org.gnome.Mutter.DisplayConfig',
    'GetCurrentState',
    null,
  )
  const monitors = state.get_child_value(1)
  const spec = monitors.get_child_value(0).get_child_value(0)
  return spec.get_child_value(0).get_string()[0]
}

const startSessions = () => {
  const remotePath = call(
    'org.gnome.Mutter.RemoteDesktop',
    '/org/gnome/Mutter/RemoteDesktop',
    'org.gnome.Mutter.RemoteDesktop',
    'CreateSession',
    null,
  )
    .get_child_value(0)
    .get_string()[0]

  const remoteId = getProperty(
    'org.gnome.Mutter.RemoteDesktop',
    remotePath,
    'org.gnome.Mutter.RemoteDesktop.Session',
    'SessionId',
  ).get_string()[0]

  const castPath = call(
    'org.gnome.Mutter.ScreenCast',
    '/org/gnome/Mutter/ScreenCast',
    'org.gnome.Mutter.ScreenCast',
    'CreateSession',
    new GLib.Variant('(a{sv})', [{ 'remote-desktop-session-id': new GLib.Variant('s', remoteId) }]),
  )
    .get_child_value(0)
    .get_string()[0]

  const connector = firstMonitorConnector()
  const streamPath = call(
    'org.gnome.Mutter.ScreenCast',
    castPath,
    'org.gnome.Mutter.ScreenCast.Session',
    'RecordMonitor',
    new GLib.Variant('(sa{sv})', [connector, { 'cursor-mode': new GLib.Variant('u', 1) }]),
  )
    .get_child_value(0)
    .get_string()[0]

  let nodeId = 0
  bus.signal_subscribe(
    'org.gnome.Mutter.ScreenCast',
    'org.gnome.Mutter.ScreenCast.Stream',
    'PipeWireStreamAdded',
    streamPath,
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn, _sender, _path, _iface, _signal, parameters) => {
      nodeId = parameters.get_child_value(0).get_uint32()
    },
  )

  call('org.gnome.Mutter.RemoteDesktop', remotePath, 'org.gnome.Mutter.RemoteDesktop.Session', 'Start', null)

  for (let attempt = 0; attempt < 40 && nodeId === 0; attempt += 1) sleep(0.25)
  if (nodeId === 0) throw new Error('PipeWire stream never appeared')
  print(`monitor ${connector}, pipewire node ${nodeId}`)
  return { remotePath, streamPath, nodeId }
}

const pointerTo = (session, x, y) => {
  call(
    'org.gnome.Mutter.RemoteDesktop',
    session.remotePath,
    'org.gnome.Mutter.RemoteDesktop.Session',
    'NotifyPointerMotionAbsolute',
    new GLib.Variant('(sdd)', [session.streamPath, x, y]),
  )
}

const clickPointer = (session) => {
  for (const pressed of [true, false]) {
    call(
      'org.gnome.Mutter.RemoteDesktop',
      session.remotePath,
      'org.gnome.Mutter.RemoteDesktop.Session',
      'NotifyPointerButton',
      new GLib.Variant('(ib)', [BUTTON_LEFT, pressed]),
    )
    sleep(0.15)
  }
}

const pressEscape = (session) => {
  for (const pressed of [true, false]) {
    call(
      'org.gnome.Mutter.RemoteDesktop',
      session.remotePath,
      'org.gnome.Mutter.RemoteDesktop.Session',
      'NotifyKeyboardKeysym',
      new GLib.Variant('(ub)', [0xff1b, pressed]),
    )
    sleep(0.1)
  }
}

const capture = (session, name) => {
  GLib.mkdir_with_parents(OUT_DIR, 0o755)
  const target = `${OUT_DIR}/${name}.png`
  const [, , , status] = GLib.spawn_sync(
    null,
    [
      'gst-launch-1.0',
      '-q',
      'pipewiresrc',
      `path=${session.nodeId}`,
      'num-buffers=20',
      '!',
      'videoconvert',
      '!',
      'pngenc',
      'snapshot=true',
      '!',
      'filesink',
      `location=${target}`,
    ],
    null,
    GLib.SpawnFlags.SEARCH_PATH,
    null,
  )
  print(`${target} (gst status ${status})`)
}

const main = (argv) => {
  const steps = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--click') continue
    const [coords, name] = (argv[index + 1] ?? '').split(':')
    const [x, y] = (coords ?? '').split(',').map(Number)
    if (!isFinite(x) || !isFinite(y)) continue
    steps.push({ x, y, name: name ?? `step-${steps.length + 1}` })
  }

  const session = startSessions()
  pressEscape(session)
  sleep(0.5)
  pressEscape(session)
  pointerTo(session, 700, 500)
  sleep(1)
  capture(session, 'desktop')

  for (const step of steps) {
    pointerTo(session, step.x, step.y)
    sleep(0.6)
    clickPointer(session)
    sleep(2.5)
    capture(session, step.name)
  }
  return 0
}

System.exit(main(System.programArgs))
