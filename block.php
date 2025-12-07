<?php

namespace S8\WP\blocks;

function version( $path ) {
	WP_DEBUG
		? filemtime( plugin_dir_path( __FILE__ ) . $path )
		: null;
}

/**
 * Registers the block on server.
 */
add_action( 'init', function() {
	register_block_type( __DIR__ );
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\block_editor_scripts' );
} );

function block_editor_scripts() {
	// Enqueues the block’s inspector controls as a module for the sake of trying out the
	// module scripts in WP.
	wp_register_script_module(
		'@demo-wp-masonry-block/inspector',
		plugin_dir_url( __FILE__ ) . 'inspector.js',
		[],
		version( 'inspector.js' )
	);

	// Enqueues the block editor script separately so it can come after the module script
	// and `import` it without hassle.
	wp_enqueue_script(
		's8-demo-masonry-editor-script',
		plugin_dir_url( __FILE__ ) . 'block.js',
		[
			'wp-blocks',
			'wp-block-editor',
			'wp-element',
			'wp-components',
			'wp-compose',
			'pexels',
		],
		version( 'block.js' ),
		true
	);
}
