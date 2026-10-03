# Installing the development version

The adapter is on npm but not yet in the ioBroker repositories. Until it is there, it is installed from its GitHub
repository. This way of installing is meant for development versions only.

## From GitHub

In the admin (expert mode): Adapters > install from custom source > GitHub, then enter

```
https://github.com/ssbingo/ioBroker.samba-solar-track
```

Or on the command line of the ioBroker host:

```bash
iobroker url ssbingo/ioBroker.samba-solar-track
```

Then create the instance in the admin under Adapters, or with:

```bash
iobroker add samba-solar-track
```

To update to the newest state of the repository, run the first command again. The instance restarts by itself.

## From a package file

Without access to GitHub the adapter can be installed from a file.

1. In the adapter directory on the development machine: `npm run build`, then `npm pack`. This creates
   `iobroker.samba-solar-track-<version>.tgz`.
2. Copy the file to the ioBroker host, for example to `/tmp`.
3. On the ioBroker host: `iobroker url /tmp/iobroker.samba-solar-track-<version>.tgz`

## Requirements

- ioBroker js-controller 6.0.11 or newer, admin 8.0.0 or newer, Node.js 22 or newer
- Samba Solar Track with firmware 0.0.1 or newer, WLAN switched on at the display
