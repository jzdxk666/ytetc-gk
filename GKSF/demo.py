import json
from typing import Dict, List, Tuple
import uuid


# 读取JSON文件
def load_json(file_path: str) -> Dict:
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


# 计算船舶总大小并提取贝位详情
def calculate_vessel_capacity_and_details(vessel: Dict) -> Tuple[Dict, List[Dict]]:
    total_slots = 0
    total_weight_capacity = 0
    bay_details = []

    for bay in vessel["bays"]:
        bay_info = {
            "bayNumber": bay["bayNumber"],
            "isReeferReady": bay.get("isReeferReady", False),
            "rows": [
                {
                    "rowNumber": row["rowNumber"],
                    "maxTiers": row["maxTiers"],
                    "maxWeightKg": row["maxWeightKg"]
                } for row in bay["rows"]
            ]
        }
        bay_details.append(bay_info)
        for row in bay["rows"]:
            total_slots += row["maxTiers"]
            total_weight_capacity += row["maxWeightKg"]

    capacity = {
        "totalSlots": total_slots,
        "totalWeightCapacityKg": total_weight_capacity
    }
    return capacity, bay_details


# 检查船位是否可用
def is_valid_position(vessel: Dict, bay: str, row: str, tier: int, current_weight: int, container: Dict) -> bool:
    for b in vessel["bays"]:
        if b["bayNumber"] == bay:
            for r in b["rows"]:
                if r["rowNumber"] == row:
                    # 检查层数和重量约束
                    if tier > r["maxTiers"] or current_weight + container["weightKg"] > r["maxWeightKg"]:
                        return False
                    # 冷藏箱约束
                    if container["isReefer"] and ("isReeferReady" not in b or not b["isReeferReady"]):
                        return False
                    return True
    return False


# 检查目的港约束
def check_pod_constraint(assignment: List[Dict], container: Dict, bay: str, row: str, tier: int,
                         pod_order: List[str]) -> bool:
    for placed in assignment:
        if placed["bay"] == bay and placed["row"] == row and placed["tier"] < tier:
            current_pod_idx = pod_order.index(container["pod"])
            placed_pod_idx = pod_order.index(placed["pod"])
            if current_pod_idx < placed_pod_idx:  # 目的港靠前的不能被压在靠后的下面
                return False
    return True


# 检查重量约束
def check_weight_constraint(assignment: List[Dict], container: Dict, bay: str, row: str, tier: int) -> bool:
    for placed in assignment:
        if placed["bay"] == bay and placed["row"] == row and placed["tier"] < tier:
            if placed["weightKg"] < container["weightKg"]:  # 下方重量必须大于等于上方
                return False
    return True


# 检查靠近现有危险箱
def check_near_existing_hazardous(assignment: List[Dict], bay: str, row: str, tier: int) -> bool:
    for placed in assignment:
        if placed["isHazardous"]:
            placed_bay, placed_row, placed_tier = placed["bay"], placed["row"], placed["tier"]
            if (abs(int(placed_bay) - int(bay)) <= 1 and
                    abs(int(placed_row) - int(row)) <= 1 and
                    abs(placed_tier - tier) <= 1):
                return True  # 靠近，返回True不允许
    return False


# 检查危险品约束（简化版：周围一格内无其他箱子）
def check_hazardous_constraint(assignment: List[Dict], bay: str, row: str, tier: int) -> bool:
    for placed in assignment:
        placed_bay, placed_row, placed_tier = placed["bay"], placed["row"], placed["tier"]
        if (abs(int(placed_bay) - int(bay)) <= 1 and
                abs(int(placed_row) - int(row)) <= 1 and
                abs(placed_tier - tier) <= 1):
            return False
    return True


# 检查位置是否已被占用
def check_position_occupied(assignment: List[Dict], bay: str, row: str, tier: int) -> bool:
    for placed in assignment:
        if placed["bay"] == bay and placed["row"] == row and placed["tier"] == tier:
            return True
    return False


# 检查总装载能力约束
def check_vessel_capacity(assignment: List[Dict], container: Dict, vessel_capacity: Dict) -> bool:
    total_used_slots = len(assignment)
    total_used_weight = sum(c["weightKg"] for c in assignment)
    if (total_used_slots + 1 > vessel_capacity["totalSlots"] or
            total_used_weight + container["weightKg"] > vessel_capacity["totalWeightCapacityKg"]):
        return False
    return True


# 检查重心平衡 (Stability & Trim)
def check_center_of_gravity(assignment: List[Dict], container: Dict, bay: str, row: str, tier: int,
                            vessel: Dict) -> bool:
    # 坐标定义: bay_pos = int(bay), row_pos = int(row), tier_pos = tier
    bay_pos = int(bay)
    row_pos = int(row)
    tier_pos = tier

    # 当前总重量
    total_weight = sum(c["weightKg"] for c in assignment)
    if total_weight == 0:
        return True  # 第一个箱子无重心检查

    # 当前重心
    current_cog_x = sum(c["weightKg"] * int(c["bay"]) for c in assignment) / total_weight  # 前后 (Trim)
    current_cog_y = sum(c["weightKg"] * int(c["row"]) for c in assignment) / total_weight  # 左右 (Heel)
    current_cog_z = sum(c["weightKg"] * c["tier"] for c in assignment) / total_weight  # 垂直 (Stability)

    # 新重心模拟添加后
    new_total_weight = total_weight + container["weightKg"]
    new_cog_x = (current_cog_x * total_weight + container["weightKg"] * bay_pos) / new_total_weight
    new_cog_y = (current_cog_y * total_weight + container["weightKg"] * row_pos) / new_total_weight
    new_cog_z = (current_cog_z * total_weight + container["weightKg"] * tier_pos) / new_total_weight

    # 理想重心
    bay_numbers = [int(b["bayNumber"]) for b in vessel["bays"]]
    ideal_x = (min(bay_numbers) + max(bay_numbers)) / 2  # e.g. (1+11)/2 = 6.0

    row_numbers = sorted(set(int(r["rowNumber"]) for b in vessel["bays"] for r in b["rows"]))
    ideal_y = (min(row_numbers) + max(row_numbers)) / 2  # e.g. (1+4)/2 = 2.5

    max_tier = max(r["maxTiers"] for b in vessel["bays"] for r in b["rows"])  # e.g. 8

    # 阈值: X偏离 < 2, Y < 0.5, Z < max_tier/2 + 1 (鼓励低重心)
    if abs(new_cog_x - ideal_x) > 2:
        return False
    if abs(new_cog_y - ideal_y) > 0.5:
        return False
    if new_cog_z > (max_tier / 2) + 1:
        return False

    return True


# 计算翻倒箱数量
def calculate_re_stows(yard_map: List[Dict], container_id: str) -> int:
    container_loc = next((c for c in yard_map if c["containerId"] == container_id), None)
    if not container_loc:
        return 0
    area, bay, row, tier = (container_loc["location"]["area"],
                            container_loc["location"]["bay"],
                            container_loc["location"]["row"],
                            container_loc["location"]["tier"])
    re_stows = 0
    for other in yard_map:
        if (other["location"]["area"] == area and
                other["location"]["bay"] == bay and
                other["location"]["row"] == row and
                other["location"]["tier"] > tier):
            re_stows += 1
    return re_stows


# 主算法
def optimize_loading(vessel_file: str, manifest_file: str, yard_file: str, pod_order: List[str]) -> Dict:
    # 读取数据
    vessel = load_json(vessel_file)
    containers = load_json(manifest_file)
    yard_map = load_json(yard_file)

    # 计算船舶总大小和贝位详情
    vessel_capacity, bay_details = calculate_vessel_capacity_and_details(vessel)

    # 动态扩展pod_order，允许陌生港口
    all_pods = set(c["pod"] for c in containers)
    extended_pod_order = pod_order + [p for p in all_pods if p not in pod_order]

    # 初始化结果
    assignment = []
    bay_weights = {}  # 记录每个贝位行的当前总重量

    # 按目的港和重量排序
    containers.sort(key=lambda x: (extended_pod_order.index(x["pod"]), -x["weightKg"]))

    # 为每个集装箱分配船位
    for container in containers:
        placed = False
        re_stows = calculate_re_stows(yard_map, container["containerId"])

        # 检查总装载能力
        if not check_vessel_capacity(assignment, container, vessel_capacity):
            raise Exception(
                f"无法装载集装箱 {container['containerId']}：超过船舶总箱位数 {vessel_capacity['totalSlots']} 或总重量 {vessel_capacity['totalWeightCapacityKg']} 千克")

        # 为了平衡，排序bays和rows：优先中央
        bays_sorted = sorted(vessel["bays"], key=lambda b: abs(int(b["bayNumber"]) - 6))  # 中央bay先 (中点≈6)
        for bay in bays_sorted:
            bay_num = bay["bayNumber"]
            rows_sorted = sorted(bay["rows"], key=lambda r: abs(int(r["rowNumber"]) - 2.5))  # 中央row先 (中点2.5)
            for row in rows_sorted:
                row_num = row["rowNumber"]
                key = f"{bay_num}-{row_num}"
                current_weight = bay_weights.get(key, 0)

                # 从底部向上尝试放置 (低tier先)
                for tier in range(1, row["maxTiers"] + 1):
                    if (is_valid_position(vessel, bay_num, row_num, tier, current_weight, container) and
                            not check_position_occupied(assignment, bay_num, row_num, tier) and
                            not check_near_existing_hazardous(assignment, bay_num, row_num, tier) and
                            check_pod_constraint(assignment, container, bay_num, row_num, tier, extended_pod_order) and
                            check_weight_constraint(assignment, container, bay_num, row_num, tier) and
                            (not container["isHazardous"] or check_hazardous_constraint(assignment, bay_num, row_num,
                                                                                        tier)) and
                            check_center_of_gravity(assignment, container, bay_num, row_num, tier, vessel)):
                        # 生成七位数字位置编码：Bay(2) + Row(2) + Tier(3)
                        location_code = f"{bay_num}{row_num}{tier:03d}"

                        assignment.append({
                            "containerId": container["containerId"],
                            "bay": bay_num,
                            "row": row_num,
                            "tier": tier,
                            "locationCode": location_code,  # 添加七位数字位置编码
                            "pod": container["pod"],
                            "weightKg": container["weightKg"],
                            "isHazardous": container["isHazardous"],
                            "isReefer": container["isReefer"]
                        })
                        bay_weights[key] = current_weight + container["weightKg"]
                        placed = True
                        break
                if placed:
                    break
            if placed:
                break

        if not placed:
            raise Exception(f"无法为集装箱 {container['containerId']} 找到合适位置")

    # 计算成本
    total_containers = len(containers)
    total_re_stows = sum(calculate_re_stows(yard_map, c["containerId"]) for c in containers)
    total_moves = total_containers + total_re_stows
    cost = (total_re_stows * 10) + (total_moves * 1)

    # 输出结果
    result = {
        "vesselId": vessel["vesselId"],
        "vesselCapacity": vessel_capacity,
        "bayDetails": bay_details,
        "assignment": assignment,
        "cost": cost,
        "totalReStows": total_re_stows,
        "totalMoves": total_moves
    }
    with open("loading_plan.json", "w", encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return result


# 示例调用
if __name__ == "__main__":
    vessel_file = "vessel_profile.json"
    manifest_file = "container_manifest.json"
    yard_file = "yard_map.json"
    pod_order = ["HKG", "SIN"]  # 卸货顺序：HKG先于SIN
    try:
        result = optimize_loading(vessel_file, manifest_file, yard_file, pod_order)
        print(f"装载完成，总成本: {result['cost']}, 翻倒箱: {result['totalReStows']}, 总步数: {result['totalMoves']}")
        print(
            f"船舶总大小: {result['vesselCapacity']['totalSlots']} 箱位, {result['vesselCapacity']['totalWeightCapacityKg']} 千克")
    except Exception as e:
        print(f"错误: {e}")