type = "ui_extension"
name = "product-suppliers"

[capabilities]
api_access = true
network_access = true
block_progress = false

[[extension_points]]
target = "admin.product-details.primary-button"
module = "./src/index.js"

[settings]
fields = []