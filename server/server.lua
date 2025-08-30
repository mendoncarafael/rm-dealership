local QBCore = exports['qb-core']:GetCoreObject()

-- Get Player Bucket
QBCore.Functions.CreateCallback('rm-dealership:server:getPlayerBucket', function(source, cb)
    local bucket = GetPlayerRoutingBucket(source)
    cb(bucket)
end)

-- Set Player Bucket
RegisterNetEvent('rm-dealership:server:setPlayerBucket', function(bucket)
    local source = source
    SetPlayerRoutingBucket(source, bucket)
end)

-- Give test drive keys
RegisterNetEvent('rm-dealership:server:giveTestDriveKeys', function(plate, model)
    local source = source
    -- Integration with mri_Qcarkeys for test drive
    if GetResourceState('mri_Qcarkeys') == 'started' then
        exports['mri_Qcarkeys']:GiveTempKeys(source, plate)
    end
end)

-- Initialize database table
CreateThread(function()
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `dealership_vehicles` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `model` varchar(50) NOT NULL,
            `name` varchar(100) NOT NULL,
            `price` int(11) NOT NULL,
            `category` varchar(50) NOT NULL,
            `stock` int(11) NOT NULL,
            `description` text,
            PRIMARY KEY (`id`),
            UNIQUE KEY `model` (`model`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
    
    -- Insert default vehicles (clear existing and reload)
    MySQL.query('DELETE FROM dealership_vehicles', {}, function()
        for i = 1, #Config.Vehicles do
            local vehicle = Config.Vehicles[i]
            MySQL.insert('INSERT INTO dealership_vehicles (model, name, price, category, stock, description) VALUES (?, ?, ?, ?, ?, ?)', {
                vehicle.model,
                vehicle.label,
                vehicle.price,
                vehicle.category,
                vehicle.stock,
                'A premium vehicle available at our dealership.'  -- Default description
            })
        end

    end)
end)

-- Get player's owned vehicles callback
QBCore.Functions.CreateCallback('rm-dealership:server:getPlayerVehicles', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return cb({}) end
    
    local success, result = pcall(function()
        return MySQL.query.await('SELECT vehicle FROM player_vehicles WHERE citizenid = ?', {Player.PlayerData.citizenid}, 5000)
    end)
    
    if not success or not result then
        return cb({})
    end
    
    local ownedVehicles = {}
    for i = 1, #result do
        ownedVehicles[result[i].vehicle] = true
    end
    
    cb(ownedVehicles)
end)

-- Get vehicle data callback
QBCore.Functions.CreateCallback('rm-dealership:server:getVehicleData', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return cb({}, 0, {}) end
    
    -- Check player's VIP status
    local vipDiscount = 0
    local vipType = nil
    
    if Player.PlayerData.metadata then
        -- Check for different VIP structures in metadata
        if Player.PlayerData.metadata.vip then
            -- Standard VIP structure (vip field with value)
            local vipLevel = Player.PlayerData.metadata.vip
            if Config.VIPDiscounts[vipLevel] then
                vipDiscount = Config.VIPDiscounts[vipLevel]
                vipType = vipLevel
            end
        end
        
        -- Check for zone-based VIP structure (individual fields)
        if vipDiscount == 0 then
            local zoneVips = {'zonaoeste', 'zonanorte', 'zonasul', 'cristo', 'reidorio'}
            for _, zone in pairs(zoneVips) do
                if Player.PlayerData.metadata[zone] then
                    if Config.VIPDiscounts[zone] then
                        vipDiscount = Config.VIPDiscounts[zone]
                        vipType = zone
                        break
                    end
                end
            end
        end
    end
    
    -- Check for VIP in player groups/permissions if no metadata VIP found
    if vipDiscount == 0 and Player.PlayerData.group then
        local playerGroup = Player.PlayerData.group
        if Config.VIPDiscounts[playerGroup] then
            vipDiscount = Config.VIPDiscounts[playerGroup]
            vipType = playerGroup
        end
    end
    
    MySQL.query('SELECT * FROM dealership_vehicles WHERE stock > 0', {}, function(result)
        local vehicles = {}
        if result then
            for i = 1, #result do
                local vehicle = result[i]
                -- Find the config vehicle to get additional data
                local configVehicle = nil
                for j = 1, #Config.Vehicles do
                    if Config.Vehicles[j].model == vehicle.model then
                        configVehicle = Config.Vehicles[j]
                        break
                    end
                end
                
                -- Calculate VIP price if applicable
                local originalPrice = vehicle.price
                local vipPrice = originalPrice
                if vipDiscount > 0 then
                    vipPrice = math.floor(originalPrice * (100 - vipDiscount) / 100)
                end
                
                vehicles[#vehicles + 1] = {
                    model = vehicle.model,
                    name = vehicle.name,
                    price = originalPrice,
                    vipPrice = vipPrice,
                    category = vehicle.category,
                    stock = vehicle.stock,
                    description = vehicle.description,
                    img = configVehicle and configVehicle.img or 'https://docs.fivem.net/vehicles/adder.webp', -- Fallback image
                    information = configVehicle and configVehicle.information or {TopSpeed = 100, Braking = 50, Acceleration = 50, Suspension = 50, Handling = 50},
                    discount = configVehicle and configVehicle.discount or 0
                }
            end
        end
        
        local playerMoney = Player.PlayerData.money['bank'] or 0
        local vipInfo = {
            hasVip = vipDiscount > 0,
            vipType = vipType,
            vipDiscount = vipDiscount
        }
        
        cb(vehicles, playerMoney, vipInfo)
    end)
end)

-- Get admin data callback
QBCore.Functions.CreateCallback('rm-dealership:server:getAdminData', function(source, cb)
    MySQL.query('SELECT * FROM dealership_vehicles', {}, function(result)
        local vehicles = {}
        if result then
            for i = 1, #result do
                local vehicle = result[i]
                -- Find the config vehicle to get additional data
                local configVehicle = nil
                for j = 1, #Config.Vehicles do
                    if Config.Vehicles[j].model == vehicle.model then
                        configVehicle = Config.Vehicles[j]
                        break
                    end
                end
                
                vehicles[#vehicles + 1] = {
                    model = vehicle.model,
                    name = vehicle.name,
                    price = vehicle.price,
                    category = vehicle.category,
                    stock = vehicle.stock,
                    description = vehicle.description,
                    img = configVehicle and configVehicle.img or 'https://docs.fivem.net/vehicles/adder.webp',
                    information = configVehicle and configVehicle.information or {TopSpeed = 100, Braking = 50, Acceleration = 50, Suspension = 50, Handling = 50},
                    discount = configVehicle and configVehicle.discount or 0
                }
            end
        end
        
        cb({
            vehicles = vehicles
        })
    end)
end)

-- Check if player already owns this vehicle model
function PlayerOwnsVehicle(citizenid, vehicleModel)
    local success, result = pcall(function()
        return MySQL.scalar.await('SELECT COUNT(*) FROM player_vehicles WHERE citizenid = ? AND vehicle = ?', {citizenid, vehicleModel}, 5000)
    end)
    
    if not success then
        return false -- Return false on database error to allow purchase (safer)
    end
    
    return result and result > 0
end

-- Buy vehicle callback
QBCore.Functions.CreateCallback('rm-dealership:server:buyVehicle', function(source, cb, vehicleData)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return cb(false, 'Jogador não encontrado') end
    
    -- Check if player already owns this vehicle model
    if PlayerOwnsVehicle(Player.PlayerData.citizenid, vehicleData.model) then
        return cb(false, 'Você já possui este modelo de veículo. Verifique sua garagem.')
    end
    
    -- Get vehicle from database with timeout protection
    local success, result = pcall(function()
        return MySQL.query.await('SELECT * FROM dealership_vehicles WHERE model = ?', {vehicleData.model}, 5000) -- 5 second timeout
    end)
    
    if not success or not result or #result == 0 then
        return cb(false, 'Veículo não encontrado na concessionária ou erro de conexão')
    end
    
    local vehicle = result[1]
    if vehicle.stock <= 0 then
        return cb(false, 'Veículo fora de estoque')
    end
    
    local finalPrice = vehicle.price
    
    -- Apply VIP discount if player has VIP
    local vipDiscount = 0
    local vipType = nil
    
    if Player.PlayerData.metadata then
        -- Check for different VIP structures in metadata
        if Player.PlayerData.metadata.vip then
            -- Standard VIP structure (vip field with value)
            local vipLevel = Player.PlayerData.metadata.vip
            if Config.VIPDiscounts[vipLevel] then
                vipDiscount = Config.VIPDiscounts[vipLevel]
                vipType = vipLevel
            end
        end
        
        -- Check for zone-based VIP structure (individual fields)
        if vipDiscount == 0 then
            local zoneVips = {'zonaoeste', 'zonanorte', 'zonasul', 'cristo', 'reidorio'}
            for _, zone in pairs(zoneVips) do
                if Player.PlayerData.metadata[zone] then
                    if Config.VIPDiscounts[zone] then
                        vipDiscount = Config.VIPDiscounts[zone]
                        vipType = zone
                        break
                    end
                end
            end
        end
    end
    
    -- Check for VIP in player groups/permissions if no metadata VIP found
    if vipDiscount == 0 and Player.PlayerData.group then
        local playerGroup = Player.PlayerData.group
        if Config.VIPDiscounts[playerGroup] then
            vipDiscount = Config.VIPDiscounts[playerGroup]
            vipType = playerGroup
        end
    end
    
    -- Apply VIP discount
    if vipDiscount > 0 then
        finalPrice = math.floor(finalPrice * (100 - vipDiscount) / 100)
    end
    
    -- Check if player has enough money
    if Player.PlayerData.money['bank'] < finalPrice then
        return cb(false, 'Fundos insuficientes. Você precisa de $' .. finalPrice)
    end
    
    -- Generate unique plate
    local plate = GenerateVehiclePlate()
    
    -- Remove money from player
    Player.Functions.RemoveMoney('bank', finalPrice)
    
    -- Add vehicle to player_vehicles (garage system) but set as out of garage (state 1)
    local insertSuccess, insertId = pcall(function()
        return MySQL.insert.await('INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', {
            Player.PlayerData.license,
            Player.PlayerData.citizenid,
            vehicleData.model,
            GetHashKey(vehicleData.model),
            '{}',
            plate,
            Config.DefaultGarage,
            1  -- 1 = out of garage (vehicle is spawned in world)
        }, 5000) -- 5 second timeout
    end)
    
    if insertSuccess and insertId then
        -- Reduce stock
        pcall(function()
            MySQL.update.await('UPDATE dealership_vehicles SET stock = stock - 1 WHERE model = ?', {vehicleData.model}, 5000)
        end)
        
        -- Send webhook if enabled
        if Config.UseWebhook and Config.WebhookURL ~= '' then
            SendDiscordWebhook(Player, vehicle, finalPrice, plate)
        end
        
        -- Give vehicle keys to player using mri_Qcarkeys
        if GetResourceState('mri_Qcarkeys') == 'started' then
            -- Give both temporary and permanent keys using the proper event
            -- The vehiclekeys:client:SetOwner event handles both temp and permanent keys
            TriggerClientEvent('vehiclekeys:client:SetOwner', source, plate, true)
        else
            -- Fallback for other key systems
        end
        
        -- Spawn vehicle at delivery location and teleport player
        TriggerClientEvent('rm-dealership:client:spawnPurchasedVehicle', source, {
            model = vehicleData.model,
            plate = plate,
            name = vehicle.name
        })
        
        -- Notify player about successful purchase
        local purchaseMessage = 'Seu ' .. vehicle.name .. ' (Placa: ' .. plate .. ') foi entregue com as chaves. Aproveite seu novo veículo!'
        local successMessage = 'Veículo comprado com sucesso! Seu ' .. vehicle.name .. ' foi entregue com as chaves (Placa: ' .. plate .. ')'
        
        -- Add VIP discount info to message if applicable
        if vipDiscount > 0 then
            local discountAmount = vehicle.price - finalPrice
            local vipInfo = string.format(' (Desconto VIP %s: -%d%% = -R$%s)', 
                vipType:upper(), 
                vipDiscount, 
                string.format("%.2f", discountAmount):gsub("%.?0+$", ""):reverse():gsub("(%d%d%d)", "%1."):reverse():gsub("^%.", "")
            )
            purchaseMessage = purchaseMessage .. vipInfo
            successMessage = successMessage .. vipInfo
        end
        
        TriggerClientEvent('ox_lib:notify', source, {
            title = 'Compra Realizada!',
            description = purchaseMessage,
            type = 'success',
            duration = 8000
        })
        
        cb(true, successMessage)
    else
        Player.Functions.AddMoney('bank', finalPrice) -- Refund on failure
        cb(false, 'Falha ao registrar veículo')
    end
end)

-- Generate unique vehicle plate with maximum retry limit
function GenerateVehiclePlate(retryCount)
    retryCount = retryCount or 0
    
    -- Prevent infinite recursion - max 50 attempts
    if retryCount >= 50 then
        -- Generate a timestamp-based plate as last resort
        local timestamp = os.time()
        return 'ER' .. string.sub(tostring(timestamp), -6)
    end
    
    local plate = ''
    local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    
    for i = 1, 8 do
        local rand = math.random(#chars)
        plate = plate .. string.sub(chars, rand, rand)
    end
    
    -- Check if plate already exists with proper error handling
    local success, result = pcall(function()
        return MySQL.scalar.await('SELECT COUNT(*) FROM player_vehicles WHERE plate = ?', {plate}, 5000) -- 5 second timeout
    end)
    
    if not success then
        -- Database error, return a timestamp-based plate
        local timestamp = os.time()
        return 'DB' .. string.sub(tostring(timestamp), -6)
    end
    
    if result and result > 0 then
        return GenerateVehiclePlate(retryCount + 1) -- Increment retry counter
    end
    
    return plate
end



-- Send Discord webhook
function SendDiscordWebhook(Player, vehicle, price, plate)
    local embed = {
        {
            title = "🚗 Vehicle Purchase",
            color = 3447003,
            fields = {
                {
                    name = "Player",
                    value = Player.PlayerData.charinfo.firstname .. " " .. Player.PlayerData.charinfo.lastname,
                    inline = true
                },
                {
                    name = "Citizen ID",
                    value = Player.PlayerData.citizenid,
                    inline = true
                },
                {
                    name = "Vehicle",
                    value = vehicle.name .. " (" .. vehicle.model .. ")",
                    inline = true
                },
                {
                    name = "Price",
                    value = "$" .. price,
                    inline = true
                },
                {
                    name = "Plate",
                    value = plate,
                    inline = true
                },
                {
                    name = "Time",
                    value = os.date("%Y-%m-%d %H:%M:%S"),
                    inline = true
                }
            },
            footer = {
                text = "RM Dealership System"
            },
            timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
        }
    }
    
    PerformHttpRequest(Config.WebhookURL, function(err, text, headers) end, 'POST', json.encode({
        username = "Dealership Bot",
        embeds = embed
    }), { ['Content-Type'] = 'application/json' })
end

-- Admin Events
RegisterNetEvent('rm-dealership:server:addVehicle', function(vehicleData)
    local source = source
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return end
    
    -- Check if player has permission
    local hasAccess = false
    for i = 1, #Config.AdminJobs do
        if Player.PlayerData.job.name == Config.AdminJobs[i] then
            hasAccess = true
            break
        end
    end
    
    if not hasAccess then
        TriggerClientEvent('ox_lib:notify', source, {
            title = 'Acesso Negado',
            description = 'Você não tem permissão para adicionar veículos',
            type = 'error'
        })
        return
    end
    
    MySQL.insert('INSERT INTO dealership_vehicles (model, name, price, category, stock, description) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), category = VALUES(category), stock = VALUES(stock), description = VALUES(description)', {
        vehicleData.model,
        vehicleData.name,
        vehicleData.price,
        vehicleData.category,
        vehicleData.stock,
        vehicleData.description
    }, function(id)
        if id then
            TriggerClientEvent('ox_lib:notify', source, {
                title = 'Sucesso',
                description = 'Veículo adicionado/atualizado com sucesso',
                type = 'success'
            })
        else
            TriggerClientEvent('ox_lib:notify', source, {
                title = 'Erro',
                description = 'Falha ao adicionar veículo',
                type = 'error'
            })
        end
    end)
end)

RegisterNetEvent('rm-dealership:server:removeVehicle', function(model)
    local source = source
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return end
    
    -- Check if player has permission
    local hasAccess = false
    for i = 1, #Config.AdminJobs do
        if Player.PlayerData.job.name == Config.AdminJobs[i] then
            hasAccess = true
            break
        end
    end
    
    if not hasAccess then
        TriggerClientEvent('ox_lib:notify', source, {
            title = 'Acesso Negado',
            description = 'Você não tem permissão para remover veículos',
            type = 'error'
        })
        return
    end
    
    MySQL.update('DELETE FROM dealership_vehicles WHERE model = ?', {model}, function(affectedRows)
        if affectedRows > 0 then
            TriggerClientEvent('ox_lib:notify', source, {
                title = 'Sucesso',
                description = 'Veículo removido com sucesso',
                type = 'success'
            })
        else
            TriggerClientEvent('ox_lib:notify', source, {
                title = 'Erro',
                description = 'Veículo não encontrado',
                type = 'error'
            })
        end
    end)
end)

RegisterNetEvent('rm-dealership:server:updateVehicle', function(vehicleData)
    local source = source
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return end
    
    -- Check if player has permission
    local hasAccess = false
    for i = 1, #Config.AdminJobs do
        if Player.PlayerData.job.name == Config.AdminJobs[i] then
            hasAccess = true
            break
        end
    end
    
    if not hasAccess then
        TriggerClientEvent('ox_lib:notify', source, {
            title = 'Acesso Negado',
            description = 'Você não tem permissão para atualizar veículos',
            type = 'error'
        })
        return
    end
    
    MySQL.update('UPDATE dealership_vehicles SET name = ?, price = ?, category = ?, stock = ?, description = ? WHERE model = ?', {
        vehicleData.name,
        vehicleData.price,
        vehicleData.category,
        vehicleData.stock,
        vehicleData.description,
        vehicleData.model
    }, function(affectedRows)
        if affectedRows > 0 then
            TriggerClientEvent('ox_lib:notify', source, {
                title = 'Sucesso',
                description = 'Veículo atualizado com sucesso',
                type = 'success'
            })
        else
            TriggerClientEvent('ox_lib:notify', source, {
                title = 'Erro',
                description = 'Falha ao atualizar veículo',
                type = 'error'
            })
        end
    end)
end)

-- Test Drive Bucket Management
QBCore.Functions.CreateCallback('rm-dealership:server:getPlayerBucket', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    if Player then
        cb(GetPlayerRoutingBucket(source))
    else
        cb(0)
    end
end)

RegisterNetEvent('rm-dealership:server:setPlayerBucket', function(bucket)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if Player then
        SetPlayerRoutingBucket(src, bucket)
    end
end)

-- Give test drive keys server-side to ensure they work
RegisterNetEvent('rm-dealership:server:giveTestDriveKeys', function(plate, vehicle)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end
    
    -- Give vehicle keys using the configured method
    if Config.VehicleKeys == 'mri_Qcarkeys' and GetResourceState('mri_Qcarkeys') == 'started' then
        -- Use ONLY the mri_Qcarkeys temp keys method
        local success = pcall(function()
            exports['mri_Qcarkeys']:GiveTempKeys(src, plate)
        end)
        
        if not success then
            -- Fallback: try the client event method
            TriggerClientEvent('vehiclekeys:client:SetOwner', src, plate, true)
        end
    elseif Config.VehicleKeys == 'qb-vehiclekeys' and GetResourceState('qb-vehiclekeys') == 'started' then
        TriggerClientEvent('vehiclekeys:client:SetOwner', src, plate)
    elseif Config.VehicleKeys == 'qbx-vehiclekeys' and GetResourceState('qbx-vehiclekeys') == 'started' then
        -- Use QBX vehicle keys exports with vehicle entity
        exports['qbx-vehiclekeys']:GiveKeys(src, vehicle, false)
    else
        -- Fallback method if configured system is not available
        TriggerClientEvent('rm-dealership:client:ensureVehicleAccess', src)
    end
end)

-- Remove test drive keys safely
RegisterNetEvent('rm-dealership:server:removeTestDriveKeys', function(plate, vehicle)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end
    
    -- Remove keys safely with error handling for the configured system
    pcall(function()
        if Config.VehicleKeys == 'mri_Qcarkeys' and GetResourceState('mri_Qcarkeys') == 'started' then
            exports['mri_Qcarkeys']:RemoveTempKeys(src, plate)
            TriggerClientEvent('mri_Qcarkeys:client:RemoveKeys', src, plate)
        elseif Config.VehicleKeys == 'qb-vehiclekeys' and GetResourceState('qb-vehiclekeys') == 'started' then
            TriggerClientEvent('vehiclekeys:client:RemoveKeys', src, plate)
        elseif Config.VehicleKeys == 'qbx-vehiclekeys' and GetResourceState('qbx-vehiclekeys') == 'started' then
            -- Use QBX vehicle keys exports with vehicle entity
            exports['qbx-vehiclekeys']:RemoveKeys(src, vehicle, false)
        end
    end)
    
    -- Try to remove key item from inventory if using ox_inventory
    pcall(function()
        if GetResourceState('ox_inventory') == 'started' then
            exports.ox_inventory:RemoveItem(src, 'vehiclekey_' .. plate, 1)
            exports.ox_inventory:RemoveItem(src, 'vehiclekey', 1)
            exports.ox_inventory:RemoveItem(src, 'car_keys', 1)
        end
    end)
    
    -- Try QBCore inventory removal
    pcall(function()
        if Player.Functions.RemoveItem then
            Player.Functions.RemoveItem('vehiclekey_' .. plate, 1)
            Player.Functions.RemoveItem('vehiclekey', 1)
            Player.Functions.RemoveItem('car_keys', 1)
        end
    end)
end)

-- Debug event to check player keys
RegisterNetEvent('rm-dealership:server:debugPlayerKeys', function(plate)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end
    
    -- Check inventory for key items
    pcall(function()
        if GetResourceState('ox_inventory') == 'started' then
            local inventory = exports.ox_inventory:GetInventory(src)
            if inventory and inventory.items then
                for slot, item in pairs(inventory.items) do
                    if item.name and (string.find(item.name, 'key') or string.find(item.name, plate)) then
                        -- Show metadata if available
                        if item.metadata then
                            -- Check if this is our test drive key
                            if item.metadata.plate == plate then
                                -- Try to remove it specifically
                                local removed = exports.ox_inventory:RemoveItem(src, 'vehiclekey', 1, item.metadata, slot)
                            end
                        end
                    end
                end
            end
        end
    end)
    
    -- Check if mri_Qcarkeys still has the key
    pcall(function()
        if GetResourceState('mri_Qcarkeys') == 'started' then
            if exports['mri_Qcarkeys'].HasKeys then
                local hasKeys = exports['mri_Qcarkeys']:HasKeys(src, plate)
            end
        end
    end)
end)

-- Give vehicle keys when using QBX vehicle keys
RegisterNetEvent('rm-dealership:server:giveVehicleKeys', function(plate)
    local src = source
    if Config.VehicleKeys == 'qbx-vehiclekeys' and GetResourceState('qbx-vehiclekeys') == 'started' then
        exports['qbx-vehiclekeys']:GiveKeys(src, plate, false) -- false means don't skip notification
    end
end)

 