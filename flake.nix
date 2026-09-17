{
  description = "Development environment";

  inputs = {
    systems.url = "github:nix-systems/default";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    {
      self,
      nixpkgs,
      systems,
    }:

    let
      inherit (nixpkgs) lib;

      eachSystem = lib.flip lib.mapAttrs (
        lib.genAttrs (import systems) (system: import nixpkgs { inherit system; })
      );
    in

    {
      devShells = eachSystem (
        system: pkgs: rec {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_24
              pkgs.pnpm
              pkgs.nixfmt
              pkgs.nushell
              pkgs.prettier
              pkgs.treefmt
            ];
          };

          # NixOS-only workarounds for running workerd (`wrangler dev`).
          nixos = pkgs.mkShell {
            inputsFrom = [ default ];
            packages = [ pkgs.patchelf ];

            # workerd ships as a generic-Linux ELF that NixOS can't load. The
            # `prepare` script (`bin/patch-workerd.nu`) rewrites its
            # interpreter and rpath to these.
            WORKERD_DYNAMIC_LOADER = "${pkgs.glibc}/lib/ld-linux-x86-64.so.2";
            WORKERD_BINARY_LIBS = lib.makeLibraryPath [ pkgs.glibc ];

            # workerd's BoringSSL doesn't read the NixOS CA store, so `fetch()`
            # inside `wrangler dev` fails TLS verification. Set in `shellHook`
            # because stdenv unsets `SSL_CERT_FILE` on shell entry.
            # https://github.com/cloudflare/workers-sdk/issues/3264
            shellHook = ''
              export SSL_CERT_FILE="${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            '';
          };
        }
      );
    };
}
