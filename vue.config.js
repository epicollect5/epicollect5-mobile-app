const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

const publicPath = process.env.NODE_ENV === 'production' ? process.env.VUE_APP_DEPLOY : '/';

module.exports = {

    pluginOptions: {
        webpackBundleAnalyzer: {
            openAnalyzer: process.env.NODE_ENV === 'production' && process.env.VUE_APP_MODE === 'PWA',
            analyzerMode: process.env.NODE_ENV === 'development' ? 'disabled' : 'server'
        }
    },
    filenameHashing: false,
    productionSourceMap: false,

    //this is to avoid compiling a lot of builds when debugging
    configureWebpack: (config) => {

        if (process.env.NODE_ENV === 'development') {
            // See available sourcemaps:
            // https://webpack.js.org/configuration/devtool/#devtool
            // config.devtool = 'eval-source-map';
            config.devtool = 'source-map';
            // console.log(`NOTICE: vue.config.js directive: ${config.devtool}`)

            config.output.devtoolModuleFilenameTemplate = (info) => {
                const resPath = path.normalize(info.resourcePath);
                const isVue = resPath.match(/\.vue$/);
                const isGenerated = info.allLoaders;

                const generated = `webpack-generated:///${resPath}?${info.hash}`;
                const vuesource = `vue-source://${resPath}`;

                return isVue && isGenerated ? generated : vuesource;
            };

            config.output.devtoolFallbackModuleFilenameTemplate =
                'webpack:///[resource-path]?[hash]';
        }

        if (process.env.NODE_ENV === 'production') {


            // // See available sourcemaps:
            // // https://webpack.js.org/configuration/devtool/#devtool
            // config.devtool = 'eval-source-map';
            // // console.log(`NOTICE: vue.config.js directive: ${config.devtool}`)

            // config.output.devtoolModuleFilenameTemplate = (info) => {
            //     const resPath = path.normalize(info.resourcePath);
            //     const isVue = resPath.match(/\.vue$/);
            //     const isGenerated = info.allLoaders;

            //     const generated = `webpack-generated:///${resPath}?${info.hash}`;
            //     const vuesource = `vue-source://${resPath}`;

            //     return isVue && isGenerated ? generated : vuesource;
            // };

            // config.output.devtoolFallbackModuleFilenameTemplate =
            //     'webpack:///[resource-path]?[hash]';

            if (process.env.VUE_APP_MODE === 'PWA') {

                config.plugins = [
                    ...config.plugins,
                    //how many files in the builds, 1 for single file
                    new webpack.optimize.LimitChunkCountPlugin({
                        maxChunks: 5
                    }),
                    //remove words arrays, they are just used for unit tests
                    new webpack.IgnorePlugin({
                        resourceRegExp: /an-array-of-/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /fake-answer-service/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /swiper.bundle.js/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /services\/database\/database-/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /services\/auth\/auth-/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /services\/filesystem/
                    }),

                    //remove console.log()
                    new TerserPlugin({
                        terserOptions: {
                            compress: {
                                drop_console: true
                            },
                            output: {
                                comments: false
                            }
                        }
                    })
                ];

                config.optimization = {
                    splitChunks: {
                        //minSize: 100000,
                        // maxSize: 150000,
                        cacheGroups: {
                            default: false,// disable the built-in groups, default & vendors (vendors is overwritten below)
                            capacitor: {
                                test: /[\\/]node_modules[\\/]@capacitor[\\/]/,
                                name: 'vendor-capacitor',
                                chunks: 'all',
                                priority: 90
                            },
                            vue: {
                                test: /[\\/]node_modules[\\/]@vue[\\/]/,
                                name: 'vendor-vue',
                                chunks: 'all',
                                priority: 80
                            },
                            ionic: {
                                test: /[\\/]node_modules[\\/](@ionic|@ionic-native)[\\/]/,
                                name: 'vendor-ionic',
                                chunks: 'all',
                                priority: 70
                            },
                            vendor: {
                                test: /[\\/]node_modules[\\/]/,
                                name: 'vendor-common',
                                //enforce: true,
                                chunks: 'all',
                                priority: 1
                            }

                        }
                    }
                };
            }
        }
    },
    //the following is to make pinia work
    //see https://github.com/vuejs/pinia/issues/675
    chainWebpack: (config) => {
        config.module
            .rule('mjs')
            .test(/\.mjs$/)
            .type('javascript/auto')
            .include.add(/node_modules/)
            .end();

        // config.module
        //     .rule('images')
        //     .use('url-loader')
        //     .loader('url-loader')
        //     .tap((options) => {
        //         // Do not base64 encode images URLs
        //         options.limit = -1;
        //         return options;
        //     });

        // if (process.env.VUE_APP_MODE === 'PWA' && process.env.NODE_ENV === 'production') {
        // config.optimization.splitChunks(false);
        // config.optimization.delete('splitChunks');
        // }


    },
    pwa: {
        //workboxPluginMode: 'GenerateSW',
        assetsVersion: '5.0.5',
        themeColor: '#673C90',
        msTileColor: '#FFFFFF'
    },
    publicPath
};