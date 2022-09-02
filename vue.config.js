const path = require('path');

module.exports = {
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
            // See available sourcemaps:
            // https://webpack.js.org/configuration/devtool/#devtool
            config.devtool = 'eval-source-map';
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
    },
    pwa: {
        assetsVersion: '5.0.5',
        themeColor: '#673C90',
        msTileColor: '#FFFFFF'
    }
};