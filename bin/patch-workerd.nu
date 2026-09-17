#!/usr/bin/env nu

# Rewrite the prebuilt workerd binary's interpreter and rpath so it runs on
# NixOS. No-op outside the flake's `nixos` shell, which supplies patchelf and
# the `WORKERD_*` variables.
#
# Patches in place: workerd's own install script would hardlink the meta
# package's binary to this one, and an in-place edit keeps both in sync.
export def main [] {
  let loader = $env.WORKERD_DYNAMIC_LOADER? | default ""
  let libs = $env.WORKERD_BINARY_LIBS? | default ""

  if ($loader | is-empty) or ($libs | is-empty) {
    return
  }

  let root = $env.FILE_PWD | path dirname

  glob $"($root)/node_modules/.pnpm/@cloudflare+workerd-linux-*/node_modules/@cloudflare/workerd-linux-*/bin/workerd"
  | each {|binary| patch $binary ($binary | path relative-to $root) $loader $libs }

  null
}

def patch [binary: path, name: string, loader: string, libs: string] {
  # Compare against the shell's store paths so a flake bump re-patches.
  let current_loader = patchelf --print-interpreter $binary | str trim
  let current_libs = patchelf --print-rpath $binary | str trim

  if $current_loader == $loader and $current_libs == $libs {
    return
  }

  let result = patchelf --set-interpreter $loader --set-rpath $libs $binary | complete

  if $result.exit_code == 0 {
    print $"(ansi green)patched(ansi reset) ($name)"
  } else if ($result.stderr =~ '(?i)text file busy') {
    print --stderr $"(ansi yellow)skipped(ansi reset) ($name): in use, likely a running dev server"
  } else {
    error make { msg: $"patchelf failed on ($name): ($result.stderr)" }
  }
}
