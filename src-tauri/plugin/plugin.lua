local HttpService = game:GetService("HttpService")
local MarketplaceService = game:GetService("MarketplaceService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local AssetService = game:GetService("AssetService")
local CollectionService = game:GetService("CollectionService")

local function copyMeshPartInto(src, dst, overrideTextureId)
  pcall(function()
    dst.Name     = src.Name
    dst.CFrame   = src.CFrame
    dst.Size     = src.Size
    dst.Anchored = src.Anchored
  end)
  pcall(function()
    dst.CanCollide = src.CanCollide
    dst.CanTouch   = src.CanTouch
    dst.CanQuery   = src.CanQuery
    dst.CastShadow = src.CastShadow
  end)
  pcall(function()
    dst.Color        = src.Color
    dst.Material     = src.Material
    dst.Transparency = src.Transparency
    dst.Reflectance  = src.Reflectance
  end)
  pcall(function() dst.MaterialVariant = src.MaterialVariant end)
  pcall(function()
    dst.Locked                   = src.Locked
    dst.Massless                 = src.Massless
    dst.RootPriority             = src.RootPriority
    dst.CustomPhysicalProperties = src.CustomPhysicalProperties
  end)
  pcall(function() dst.TextureID = overrideTextureId or src.TextureID end)

  pcall(function()
    for k, v in pairs(src:GetAttributes()) do
      pcall(function() dst:SetAttribute(k, v) end)
    end
  end)

  pcall(function()
    for _, tag in ipairs(CollectionService:GetTags(src)) do
      pcall(function() CollectionService:AddTag(dst, tag) end)
    end
  end)

  for _, child in ipairs(src:GetChildren()) do
    pcall(function() child.Parent = dst end)
  end

  if src.Parent then
    for _, obj in ipairs(src.Parent:GetDescendants()) do
      if obj ~= dst then
        pcall(function() if obj.Part0 == src then obj.Part0 = dst end end)
        pcall(function() if obj.Part1 == src then obj.Part1 = dst end end)
      end
    end
  end
end

local toolbar = plugin:CreateToolbar("ISpooferMotion")
local button = toolbar:CreateButton("Scan Now", "Manually trigger an asset scan", "rbxassetid://137844667859456")
button.ClickableWhenViewportHidden = true

local PORT = 3100
local BATCH_SIZE = 2000
local SEND_CHUNK_SIZE = 500
local BASE_URL = "http://localhost:" .. PORT
local TESTING = false

local Assets = {}
local Animations = {}
local Sounds = {}
local Scripts = {}
local Images = {}
local Meshes = {}
local Videos = {}

local seenAnimations = {}
local seenSounds = {}
local seenImages = {}
local seenMeshes = {}
local seenVideos = {}

local polling = false
local pollTask = nil

local function timeit(func)
  local startTime = os.clock()
  func()
  local endTime = os.clock()
  return math.round((endTime - startTime) * 1000)
end

local function sendToServer(endpoint, payload)
  if TESTING then
    print("[TESTING] POST to " .. endpoint)
    print(HttpService:JSONEncode(payload))
    return
  end
  local ok, err = pcall(function()
    HttpService:PostAsync(
      BASE_URL .. endpoint,
      HttpService:JSONEncode(payload),
      Enum.HttpContentType.ApplicationJson
    )
  end)
  if not ok then
    warn("[AssetCollection] Failed to POST to " .. endpoint .. ": " .. tostring(err))
  end
end

local function sendBatched(endpoint, assetsList, placeId, timestamp)
  if #assetsList == 0 then return end
  for i = 1, #assetsList, SEND_CHUNK_SIZE do
    local chunk = {}
    for j = i, math.min(i + SEND_CHUNK_SIZE - 1, #assetsList) do
      table.insert(chunk, assetsList[j])
    end
    print(string.format("[AssetCollection] Sending batch %d-%d of %d to %s", i, i + #chunk - 1, #assetsList, endpoint))
    sendToServer(endpoint, {
      timestamp = timestamp,
      placeId = placeId,
      assetCount = #chunk,
      assets = chunk,
    })
  end
end

local IGNORED_SERVICES = {
  PluginGuiService = true,
  CoreGui = true,
}

local function initialScan()
  print("started")
  local all = game:GetDescendants()
  for _, obj in ipairs(all) do
    local root = obj
    while root.Parent and root.Parent ~= game do
      root = root.Parent
    end
    if not IGNORED_SERVICES[root.Name] then
      table.insert(Assets, obj)
    end
  end
  print("Filtered assets:", #Assets, "(excluded PluginGuiService, CoreGui)")
end

local ASSET_TYPE_ANIMATION = { [24] = true, [61] = true }
local ASSET_TYPE_SOUND = { [3] = true }
local ASSET_TYPE_IMAGE = { [1] = true, [13] = true }
local ASSET_TYPE_MESH = { [4] = true, [40] = true }
local ASSET_TYPE_VIDEO = { [62] = true }

local assetTypeCache = {}

local function getAssetType(assetId)
  if assetTypeCache[assetId] then
    return assetTypeCache[assetId]
  end
  local ok, info = pcall(function()
    return MarketplaceService:GetProductInfo(tonumber(assetId))
  end)
  if ok and info and info.AssetTypeId then
    local typeId = info.AssetTypeId
    local category = "unknown"
    if ASSET_TYPE_ANIMATION[typeId] then
      category = "animation"
    elseif ASSET_TYPE_SOUND[typeId] then
      category = "sound"
    elseif ASSET_TYPE_IMAGE[typeId] then
      category = "image"
    elseif ASSET_TYPE_MESH[typeId] then
      category = "mesh"
    elseif ASSET_TYPE_VIDEO[typeId] then
      category = "video"
    end
    assetTypeCache[assetId] = category
    return category
  else
    warn("[AssetCollection] Could not resolve asset type for ID " .. tostring(assetId))
    assetTypeCache[assetId] = "unknown"
    return "unknown"
  end
end

local LOOSE_ID_PATTERNS = {
  "%.AnimationId%s*=%s*(%d%d%d%d%d%d%d+)",
  "%.SoundId%s*=%s*(%d%d%d%d%d%d%d+)",
  "%.MeshId%s*=%s*(%d%d%d%d%d%d%d+)",
  "%.TextureId%s*=%s*(%d%d%d%d%d%d%d+)",
  "%.TextureID%s*=%s*(%d%d%d%d%d%d%d+)",
  "%.Image%s*=%s*(%d%d%d%d%d%d%d+)",
  "%.Video%s*=%s*(%d%d%d%d%d%d%d+)",
  "[Aa]nim[%a_]*%s*[=:]%s*(%d%d%d%d%d%d%d+)",
  "[Ss]ound[%a_]*%s*[=:]%s*(%d%d%d%d%d%d%d+)",
  "[Aa]udio[%a_]*%s*[=:]%s*(%d%d%d%d%d%d%d+)",
  "[Mm]usic[%a_]*%s*[=:]%s*(%d%d%d%d%d%d%d+)",
  "[Mm]esh[%a_]*%s*[=:]%s*(%d%d%d%d%d%d%d+)",
  "[Vv]ideo[%a_]*%s*[=:]%s*(%d%d%d%d%d%d%d+)",
  "[Aa]sset[Ii][Dd][%a_]*%s*[=:]%s*(%d%d%d%d%d%d%d+)",
  '%["[Aa]nim[%a_]*"%]%s*=%s*(%d%d%d%d%d%d%d+)',
  '%["[Ss]ound[%a_]*"%]%s*=%s*(%d%d%d%d%d%d%d+)',
  '%["[Mm]esh[%a_]*"%]%s*=%s*(%d%d%d%d%d%d%d+)',
  '%["[Vv]ideo[%a_]*"%]%s*=%s*(%d%d%d%d%d%d%d+)',
}

local function extractIdsFromSource(source)
  local ids = {}
  for id in source:gmatch("rbxassetid://(%d+)") do
    ids[id] = true
  end
  for id in source:gmatch("https?://[%w%.]*roblox%.com/[Aa]sset/%?[Ii][Dd]=(%d+)") do
    ids[id] = true
  end
  for id in source:gmatch("rbxthumb://type=Asset&id=(%d+)") do
    ids[id] = true
  end
  for _, pattern in ipairs(LOOSE_ID_PATTERNS) do
    for id in source:gmatch(pattern) do
      ids[id] = true
    end
  end
  local assetTablePatterns = {
    "[Aa]nim[%a_0-9]*%s*=%s*{",
    "[Ss]ound[%a_0-9]*%s*=%s*{",
    "[Aa]udio[%a_0-9]*%s*=%s*{",
    "[Mm]usic[%a_0-9]*%s*=%s*{",
    "[Mm]esh[%a_0-9]*%s*=%s*{",
    "[Vv]ideo[%a_0-9]*%s*=%s*{",
    "[Tt]exture[%a_0-9]*%s*=%s*{",
    "[Aa]sset[Ii][Dd][%a_0-9]*%s*=%s*{",
  }
  for _, tablePattern in ipairs(assetTablePatterns) do
    local startPos = 1
    while true do
      local _, matchEnd = source:find(tablePattern, startPos)
      if not matchEnd then break end
      local depth = 1
      local pos = matchEnd + 1
      while pos <= #source and depth > 0 do
        local ch = source:sub(pos, pos)
        if ch == "{" then
          depth = depth + 1
        elseif ch == "}" then
          depth = depth - 1
        end
        pos = pos + 1
      end
      local block = source:sub(matchEnd + 1, pos - 2)
      for id in block:gmatch("(%d%d%d%d%d%d%d+)") do
        ids[id] = true
      end
      startPos = pos
    end
  end
  return ids
end


local function getIdFromContent(value)
  if not value then
    return nil
  end

  local content = tostring(value)
  return content:match("rbxassetid://(%d+)")
      or content:match("roblox%.com/[Aa]sset/%?[Ii][Dd]=(%d+)")
      or content:match("rbxthumb://type=Asset&id=(%d+)")
      or content:match("^(%d+)$")
end

local function scan()
  Assets = {}
  Animations = {}
  Sounds = {}
  Scripts = {}
  Images = {}
  Meshes = {}
  Videos = {}
  seenAnimations = {}
  seenSounds = {}
  seenImages = {}
  seenMeshes = {}
  seenVideos = {}

  local all = game:GetDescendants()
  for _, obj in ipairs(all) do
    local root = obj
    while root.Parent and root.Parent ~= game do
      root = root.Parent
    end
    if not IGNORED_SERVICES[root.Name] then
      table.insert(Assets, obj)
    end
  end

  print("Total assets:", #Assets)
  local count = 0

  local animationData = {}
  local soundData = {}
  local imageData = {}
  local meshData = {}
  local videoData = {}
  local scriptRefData = {}

  for _, obj in ipairs(Assets) do
    if obj:IsA("Animation") then
      table.insert(Animations, obj)
      local id = getIdFromContent(obj.AnimationId)
      if id and not seenAnimations[id] then
        seenAnimations[id] = true
        table.insert(animationData, {
          kind = "AnimationInstance",
          name = obj.Name,
          fullName = obj:GetFullName(),
          animationId = obj.AnimationId,
          assetId = id,
        })
      end
    elseif obj:IsA("Sound") then
      table.insert(Sounds, obj)
      local id = getIdFromContent(obj.SoundId)
      if id and not seenSounds[id] then
        seenSounds[id] = true
        table.insert(soundData, {
          kind = "SoundInstance",
          name = obj.Name,
          fullName = obj:GetFullName(),
          soundId = obj.SoundId,
          assetId = id,
        })
      end
    elseif obj:IsA("Script") or obj:IsA("LocalScript") or obj:IsA("ModuleScript") then
      table.insert(Scripts, obj)
      local sourceOk, source = pcall(function() return obj.Source end)
      if sourceOk and source then
        local ids = extractIdsFromSource(source)
        for id in pairs(ids) do
          local assetType = getAssetType(id)

          table.insert(scriptRefData, {
            kind = "ScriptReference",
            script = obj:GetFullName(),
            scriptType = obj.ClassName,
            assetId = id,
            rawUrl = "rbxassetid://" .. id,
            resolvedType = assetType,
          })

          if assetType == "animation" and not seenAnimations[id] then
            seenAnimations[id] = true
            table.insert(animationData, {
              kind = "ScriptReference",
              name = "rbxassetid://" .. id,
              fullName = obj:GetFullName(),
              animationId = "rbxassetid://" .. id,
              assetId = id,
            })
          elseif assetType == "sound" and not seenSounds[id] then
            seenSounds[id] = true
            table.insert(soundData, {
              kind = "ScriptReference",
              name = "rbxassetid://" .. id,
              fullName = obj:GetFullName(),
              soundId = "rbxassetid://" .. id,
              assetId = id,
            })
          elseif assetType == "image" and not seenImages[id] then
            seenImages[id] = true
            table.insert(imageData, {
              kind = "ScriptReference",
              name = "rbxassetid://" .. id,
              fullName = obj:GetFullName(),
              imageId = "rbxassetid://" .. id,
              assetId = id,
            })
          elseif assetType == "mesh" and not seenMeshes[id] then
            seenMeshes[id] = true
            table.insert(meshData, {
              kind = "ScriptReference",
              name = "rbxassetid://" .. id,
              fullName = obj:GetFullName(),
              meshId = "rbxassetid://" .. id,
              assetId = id,
            })
          elseif assetType == "video" and not seenVideos[id] then
            seenVideos[id] = true
            table.insert(videoData, {
              kind = "ScriptReference",
              name = "rbxassetid://" .. id,
              fullName = obj:GetFullName(),
              videoId = "rbxassetid://" .. id,
              assetId = id,
            })
          end
        end
      else
        warn("[AssetCollection] Could not read source of " .. obj:GetFullName())
      end
    elseif obj:IsA("Decal") or obj:IsA("Texture") then
      table.insert(Images, obj)
      local tex = obj.Texture
      local id = getIdFromContent(tex)
      if id and not seenImages[id] then
        seenImages[id] = true
        table.insert(imageData, {
          kind = obj.ClassName,
          name = obj.Name,
          fullName = obj:GetFullName(),
          property = "Texture",
          imageId = tex,
          assetId = id,
        })
      end
    elseif obj:IsA("ImageLabel") or obj:IsA("ImageButton") then
      table.insert(Images, obj)
      local img = obj.Image
      local id = getIdFromContent(img)
      if id and not seenImages[id] then
        seenImages[id] = true
        table.insert(imageData, {
          kind = obj.ClassName,
          name = obj.Name,
          fullName = obj:GetFullName(),
          property = "Image",
          imageId = img,
          assetId = id,
        })
      end
    elseif obj:IsA("VideoFrame") then
      table.insert(Videos, obj)
      local readOk, video = pcall(function() return obj.Video end)
      local id = readOk and getIdFromContent(video) or nil
      if id and not seenVideos[id] then
        seenVideos[id] = true
        table.insert(videoData, {
          kind = "VideoFrame",
          name = obj.Name,
          fullName = obj:GetFullName(),
          property = "Video",
          videoId = tostring(video),
          assetId = id,
        })
      end
    elseif obj:IsA("MeshPart") then
      table.insert(Meshes, obj)
      local meshId = obj.MeshId ~= "" and getIdFromContent(obj.MeshId) or nil
      if not meshId then
        local ok, contentStr = pcall(function() return tostring(obj.MeshContent) end)
        if ok and contentStr then
          meshId = getIdFromContent(contentStr)
        end
      end
      local texId = obj.TextureID ~= "" and getIdFromContent(obj.TextureID) or nil
      if meshId and not seenMeshes[meshId] then
        seenMeshes[meshId] = true
        table.insert(meshData, {
          kind = "MeshPart",
          name = obj.Name,
          fullName = obj:GetFullName(),
          meshId = obj.MeshId,
          assetId = meshId,
          textureId = obj.TextureID,
          textureAssetId = texId,
        })
      end
    elseif obj:IsA("SpecialMesh") then
      table.insert(Meshes, obj)
      local id = obj.MeshId ~= "" and getIdFromContent(obj.MeshId) or nil
      if id and not seenMeshes[id] then
        seenMeshes[id] = true
        table.insert(meshData, {
          kind = "SpecialMesh",
          name = obj.Name,
          fullName = obj:GetFullName(),
          meshId = obj.MeshId,
          assetId = id,
        })
      end
    end

    count += 1
    if count >= BATCH_SIZE then
      count = 0
      task.wait()
    end
  end

  print(string.format(
    "Found %d Animations (%d unique), %d Sounds, %d Scripts (%d refs), %d Images, %d Meshes, %d Videos",
    #Animations, #animationData, #Sounds, #Scripts, #scriptRefData, #Images, #Meshes, #Videos
  ))

  local placeId = game.PlaceId
  local timestamp = os.time()

  sendBatched("/assets-animations", animationData, placeId, timestamp)
  sendBatched("/assets-sounds", soundData, placeId, timestamp)
  sendBatched("/assets-images", imageData, placeId, timestamp)
  sendBatched("/assets-meshes", meshData, placeId, timestamp)
  sendBatched("/assets-videos", videoData, placeId, timestamp)
  sendBatched("/assets-script-refs", scriptRefData, placeId, timestamp)

  -- Signal completion for each category so the app knows the scan is done
  sendToServer("/animations-complete", {})
  sendToServer("/sounds-complete", {})
  sendToServer("/images-complete", {})
  sendToServer("/meshes-complete", {})
  sendToServer("/script-refs-complete", {})

  print("[AssetCollection] All data sent and completed.")
end

local function safeIdStr(v)
  if type(v) == "number" then
    return string.format("%.0f", v)
  end
  return tostring(v)
end

local function replaceIds(mappings)
  local idMap = {}
  for _, m in ipairs(mappings) do
    local oldId = safeIdStr(m.originalId)
    local newId = safeIdStr(m.newId)
    idMap[oldId] = newId
    print("[Replace] Mapping loaded:", oldId, "->", newId)
  end

  local replaced = 0
  local descendants = game:GetDescendants()
  local processedCount = 0
  local YIELD_EVERY = 50
  local dbgAnimChecked, dbgScriptChecked, dbgSourceFail = 0, 0, 0

  for _, obj in ipairs(descendants) do
    processedCount += 1
    if processedCount % YIELD_EVERY == 0 then
      task.wait()
    end

    local stillValid, _ = pcall(function() return obj.Parent end)
    if not stillValid then continue end

    if obj:IsA("Animation") then
      dbgAnimChecked += 1
      local readOk, id = pcall(function()
        local v = obj.AnimationId:match("rbxassetid://(%d+)")
        if not v then v = obj.AnimationId:match("^(%d+)$") end
        return v
      end)
      if readOk and id and idMap[id] then
        local writeOk, writeErr = pcall(function()
          obj.AnimationId = "rbxassetid://" .. idMap[id]
        end)
        if writeOk then
          replaced += 1
          print("[Replace] Animation", obj:GetFullName(), id, "->", idMap[id])
        else
          warn("[Replace] Animation write failed:", obj:GetFullName(), writeErr)
        end
      end
    elseif obj:IsA("Sound") then
      local readOk, id = pcall(function() return obj.SoundId:match("rbxassetid://(%d+)") end)
      if readOk and id and idMap[id] then
        local writeOk, writeErr = pcall(function()
          obj.SoundId = "rbxassetid://" .. idMap[id]
        end)
        if writeOk then
          replaced += 1
          print("[Replace] Sound", obj:GetFullName(), id, "->", idMap[id])
        else
          warn("[Replace] Sound write failed:", obj:GetFullName(), writeErr)
        end
      end
    elseif obj:IsA("Decal") or obj:IsA("Texture") then
      local readOk, id = pcall(function() return obj.Texture:match("rbxassetid://(%d+)") end)
      if readOk and id and idMap[id] then
        local writeOk, writeErr = pcall(function()
          obj.Texture = "rbxassetid://" .. idMap[id]
        end)
        if writeOk then
          replaced += 1
          print("[Replace] " .. obj.ClassName, obj:GetFullName(), id, "->", idMap[id])
        else
          warn("[Replace] Texture write failed:", obj:GetFullName(), writeErr)
        end
      end
    elseif obj:IsA("ImageLabel") or obj:IsA("ImageButton") then
      local readOk, id = pcall(function() return obj.Image:match("rbxassetid://(%d+)") end)
      if readOk and id and idMap[id] then
        local writeOk, writeErr = pcall(function()
          obj.Image = "rbxassetid://" .. idMap[id]
        end)
        if writeOk then
          replaced += 1
          print("[Replace] " .. obj.ClassName, obj:GetFullName(), id, "->", idMap[id])
        else
          warn("[Replace] Image write failed:", obj:GetFullName(), writeErr)
        end
      end
    elseif obj:IsA("VideoFrame") then
      local readOk, id = pcall(function() return getIdFromContent(obj.Video) end)
      if readOk and id and idMap[id] then
        local writeOk, writeErr = pcall(function()
          obj.Video = "rbxassetid://" .. idMap[id]
        end)
        if writeOk then
          replaced += 1
          print("[Replace] VideoFrame", obj:GetFullName(), id, "->", idMap[id])
        else
          warn("[Replace] Video write failed:", obj:GetFullName(), writeErr)
        end
      end
    elseif obj:IsA("MeshPart") then
      local meshId
      pcall(function()
        local v = obj.MeshId ~= "" and obj.MeshId:match("rbxassetid://(%d+)") or nil
        if not v then
          local ok2, contentStr = pcall(function() return tostring(obj.MeshContent) end)
          if ok2 and contentStr then
            v = contentStr:match("rbxassetid://(%d+)") or contentStr:match("^(%d+)$")
          end
        end
        meshId = v
      end)
      local targetMeshId = meshId and idMap[meshId]

      local texId
      pcall(function()
        local raw = obj.TextureID
        texId = (raw and raw ~= "") and raw:match("rbxassetid://(%d+)") or nil
      end)
      local targetTexId = texId and idMap[texId]

      if targetMeshId then
        local swapOk, newPart = pcall(function()
          return AssetService:CreateMeshPartAsync("rbxassetid://" .. targetMeshId, {
            CollisionFidelity = obj.CollisionFidelity,
            RenderFidelity    = obj.RenderFidelity,
          })
        end)

        local objStillValid = pcall(function() return obj.Parent end)
        if swapOk and newPart and objStillValid then
          local overrideTex = targetTexId and ("rbxassetid://" .. targetTexId) or nil
          local copyOk, copyErr = pcall(copyMeshPartInto, obj, newPart, overrideTex)
          if not copyOk then
            warn("[Replace] MeshPart copy failed:", copyErr)
          end
          pcall(function() newPart.Parent = obj.Parent end)
          pcall(function() obj:Destroy() end)
          replaced += 1
          pcall(function()
            print("[Replace] MeshPart", newPart:GetFullName(), meshId, "->", targetMeshId)
          end)
          if targetTexId then
            replaced += 1
          end
        elseif not swapOk then
          warn("[Replace] CreateMeshPartAsync failed for",
            pcall(function() return obj:GetFullName() end) and obj:GetFullName() or "unknown", ":", tostring(newPart))
        end
      elseif targetTexId then
        local writeOk, writeErr = pcall(function()
          obj.TextureID = "rbxassetid://" .. targetTexId
        end)
        if writeOk then
          replaced += 1
          print("[Replace] MeshPart.TextureID", obj:GetFullName(), texId, "->", targetTexId)
        else
          warn("[Replace] MeshPart.TextureID write failed:", obj:GetFullName(), writeErr)
        end
      end
    elseif obj:IsA("SpecialMesh") then
      local readOk, id = pcall(function() return obj.MeshId:match("rbxassetid://(%d+)") end)
      if readOk and id and idMap[id] then
        local writeOk, writeErr = pcall(function()
          obj.MeshId = "rbxassetid://" .. idMap[id]
        end)
        if writeOk then
          replaced += 1
          print("[Replace] SpecialMesh", obj:GetFullName(), id, "->", idMap[id])
        else
          warn("[Replace] SpecialMesh write failed:", obj:GetFullName(), writeErr)
        end
      end
    elseif obj:IsA("Script") or obj:IsA("LocalScript") or obj:IsA("ModuleScript") then
      dbgScriptChecked += 1
      local sourceOk, source = pcall(function() return obj.Source end)
      if not sourceOk or not source or source == "" then
        dbgSourceFail += 1
      end
      if sourceOk and source then
        local newSource = source
        for oldId, newId in pairs(idMap) do
          newSource = newSource:gsub("rbxassetid://" .. oldId, "rbxassetid://" .. newId)
          newSource = newSource:gsub("(roblox%.com/[Aa]sset/%?[Ii][Dd]=)" .. oldId, "%1" .. newId)
          newSource = newSource:gsub("([=:{,]%s*)" .. oldId .. "(%f[%D])", "%1" .. newId .. "%2")
        end
        if newSource ~= source then
          local writeOk, writeErr
          if #newSource >= 200000 then
            writeOk, writeErr = pcall(function()
              ScriptEditorService:UpdateSourceAsync(obj, function() return newSource end)
            end)
          else
            writeOk, writeErr = pcall(function() obj.Source = newSource end)
          end
          if writeOk then
            replaced += 1
            print("[Replace] Script source", obj:GetFullName())
          else
            warn("[Replace] Script write failed:", obj:GetFullName(), writeErr)
          end
        end
      end
    end
  end

  print(string.format("[Replace] Stats: %d animations checked, %d scripts checked (%d unreadable)", dbgAnimChecked,
    dbgScriptChecked, dbgSourceFail))
  print(string.format("[AssetCollection] Replacement complete: %d properties updated across %d mappings", replaced,
    #mappings))
end

local function init()
  Assets = {}
  Animations = {}
  Sounds = {}
  Scripts = {}
  Images = {}
  Meshes = {}
  Videos = {}
  seenAnimations = {}
  seenSounds = {}
  seenImages = {}
  seenMeshes = {}
  seenVideos = {}

  initialScan()
  task.spawn(scan)
end

local function startPolling()
  polling = true
  pollTask = task.spawn(function()
    while polling do
      local ok, response = pcall(function()
        return HttpService:GetAsync(BASE_URL .. "/poll")
      end)
      if ok and response then
        local decodedOk, decoded = pcall(function()
          return HttpService:JSONDecode(response)
        end)
        if decodedOk and decoded and decoded.requestAssets then
          print("[AssetCollection] Server requested scan")
          init()
        end
      end

      local replOk, replResponse = pcall(function()
        return HttpService:GetAsync(BASE_URL .. "/poll-replacements")
      end)
      if replOk and replResponse then
        local decOk, decData = pcall(function()
          return HttpService:JSONDecode(replResponse)
        end)
        if decOk and decData and decData.mappings and #decData.mappings > 0 then
          print("[AssetCollection] Received " .. #decData.mappings .. " replacement mappings")
          task.spawn(replaceIds, decData.mappings)
        end
      end

      task.wait(0.5)
    end
  end)
end

local function stopPolling()
  polling = false
  pollTask = nil
  print("[AssetCollection] Polling stopped")
end

button.Click:Connect(function()
  button.Enabled = false
  local time = timeit(init)
  print("Scan initiated in " .. time .. "ms (running async)")
  button.Enabled = true
end)

_G.ISMReplace = function(oldId, newId)
  task.spawn(replaceIds, { { originalId = tostring(oldId), newId = tostring(newId) } })
end

-- Auto-start polling as soon as the plugin loads
print("[ISpooferMotion] Auto-starting server polling...")
startPolling()
