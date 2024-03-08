<?php

namespace s8\WP\blocks;

/**
 * Registers the block on server.
 */
add_action( 'init', function() {
    register_block_type_from_metadata( __DIR__ );
} );
