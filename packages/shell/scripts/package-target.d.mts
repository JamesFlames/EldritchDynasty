export interface PackageTarget {
  readonly mode: 'game' | 'mod-editor';
  readonly renderer: 'client' | 'editor';
  readonly output: string;
  readonly appId?: string;
  readonly productName?: string;
  readonly main?: string;
}

export declare const GAME_PACKAGE: Readonly<PackageTarget>;
export declare const MOD_EDITOR_PACKAGE: Readonly<PackageTarget>;

export declare function packageTarget(args?: string[]): Readonly<PackageTarget>;

export declare function builderOverrides(
  target: Readonly<PackageTarget>,
  electronVersion: string,
): Record<string, unknown>;
