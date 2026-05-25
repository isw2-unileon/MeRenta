CREATE TABLE item_image (
    image_id      uuid                   NOT NULL DEFAULT gen_random_uuid(),
    item_id       uuid                   NOT NULL,
    image_url     text                   NOT NULL,
    display_order integer                NOT NULL DEFAULT 1,
    CONSTRAINT item_image_pkey        PRIMARY KEY (image_id),
    CONSTRAINT item_image_item_id_fkey FOREIGN KEY (item_id)
        REFERENCES item (item_id) ON DELETE CASCADE
);
