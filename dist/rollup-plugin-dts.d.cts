import { PluginImpl } from 'rollup';
import ts from 'typescript';

interface Options {
    /**
     * The plugin will by default flag *all* external libraries as `external`,
     * and thus prevent them from be bundled.
     * If you set the `respectExternal` option to `true`, the plugin will not do
     * any default classification, but rather use the `external` option as
     * configured via rollup.
     */
    respectExternal?: boolean;
    /**
     * In case you want to use TypeScript path-mapping feature, using the
     * `baseUrl` and `paths` properties, you can pass in `compilerOptions`.
     */
    compilerOptions?: ts.CompilerOptions;
    /**
     * Path to tsconfig.json, by default, will try to load 'tsconfig.json'
     */
    tsconfig?: string;
    /**
     * Include these specific (external) libraries in the bundle
     */
    include?: string[];
}

declare const plugin: PluginImpl<Options>;

export { type Options, plugin as default, plugin as dts };
