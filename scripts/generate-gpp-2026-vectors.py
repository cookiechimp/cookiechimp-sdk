"""Generate independent test vectors from pinned IAB field tables.

Uses integer packing and imports no SDK encoder. Run from any directory, then
format the generated JSON with the repository's pinned Biome.
"""

import json
import pathlib
import random

ROOT = pathlib.Path(__file__).resolve().parents[1]
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
SOURCE_COMMIT = "03fdf0332d261ee896b77d7f9a10edde1498fc7c"
SALE_FIELDS = [
    "ProcessingNotice",
    "SaleOptOutNotice",
    "TargetedAdvertisingOptOutNotice",
    "SaleOptOut",
    "TargetedAdvertisingOptOut",
]
MSPA_FIELDS = [
    "MspaCoveredTransaction",
    "MspaOptOutOptionMode",
    "MspaServiceProviderMode",
]
STATES = [("usmn", 23), ("usmd", 24), ("usin", 25), ("usky", 26), ("usri", 27)]
LAYOUTS = {
    "usmn": [(key, 1) for key in SALE_FIELDS]
    + [("SensitiveDataProcessing", 8), ("KnownChildSensitiveDataConsents", 1),
       ("AdditionalDataProcessingConsent", 1)]
    + [(key, 1) for key in MSPA_FIELDS],
    "usmd": [(key, 1) for key in ["MspaCoveredTransaction", "MspaMode"]
             + SALE_FIELDS + ["AdditionalDataProcessingConsent"]],
}
for state in ["usin", "usky", "usri"]:
    LAYOUTS[state] = [
        (key, 1)
        for key in ["MspaCoveredTransaction", "MspaMode"] + SALE_FIELDS
        + ["KnownChildSensitiveDataConsents", "AdditionalDataProcessingConsent"]
    ]


def pack(fields, byte_padding=False):
    """Pack unsigned integers arithmetically, without the SDK's string encoder."""
    number = 0
    length = 0
    for value, width in fields:
        number = (number << width) | value
        length += width
    if byte_padding:
        padding = (-length) % 8
        number <<= padding
        length += padding
    padding = (-length) % 6
    number <<= padding
    length += padding
    return "".join(
        ALPHABET[(number >> shift) & 63]
        for shift in range(length - 6, -1, -6)
    )


def vectors():
    results = []
    for name, section_id in STATES:
        for case in ["default", "ones", "twos", "mixed", "omitted"]:
            rand = random.Random(section_id)
            values = {}
            core = [(1, 6)]
            for field, count in LAYOUTS[name]:
                number = 1 if field == "MspaCoveredTransaction" else 0
                if case == "ones":
                    number = 1
                if case == "twos":
                    number = 2
                if case == "mixed":
                    number = 2 if field == "MspaCoveredTransaction" else rand.randrange(3)
                value = (
                    [rand.randrange(3) if case == "mixed" else number for _ in range(count)]
                    if count > 1 else number
                )
                if case not in ["default", "omitted"]:
                    values[field] = value
                core.extend((item, 2) for item in (value if isinstance(value, list) else [value]))
            included = case != "omitted"
            gpc = name in ["usmn", "usmd"]
            if gpc and case in ["ones", "mixed"]:
                values["Gpc"] = True
            if not gpc and included:
                values["SensitiveDataProcessing"] = [
                    0 if case == "default" else (index + section_id) % 3
                    for index in range(8)
                ]
            if not included:
                values["GpcSegmentIncluded" if gpc else "SensitiveDataConsentSegmentIncluded"] = False
            parts = [pack(core, name == "usmn")]
            if name != "usmn":
                # The only additional subsection is ID 1: singleton flag 0,
                # Fibonacci integer 1 = 11. Core ID zero is never listed.
                header = [(section_id, 6), (1, 6), (1 if included else 0, 12)]
                if included:
                    header += [(0, 1), (3, 2)]
                parts.insert(0, pack(header))
            if included:
                extra = (
                    pack([(1, 2), (int(values.get("Gpc", False)), 1)], name == "usmn")
                    if gpc else pack([(item, 2) for item in values["SensitiveDataProcessing"]])
                )
                parts.append(extra)
            results.append({"name": name, "case": case, "values": values, "encoded": ".".join(parts)})
    return results


if __name__ == "__main__":
    filenames = [
        ("IN", "Indiana"), ("KY", "Kentucky"), ("MD", "Maryland"),
        ("MN", "Minnesota"), ("RI", "Rhode Island"),
    ]
    output = {
        "commit": SOURCE_COMMIT,
        "paths": [
            f"Sections/US-States/{state}/{name} Privacy Technical Specification.md"
            for state, name in filenames
        ],
        "method": (
            "Independent integer packing from pinned IAB field tables. Modern headers "
            "exclude core subsection zero and use 6-bit padding. Minnesota retains "
            "byte-padding compatibility with the published reference format."
        ),
        "vectors": vectors(),
    }
    target = ROOT / "packages/core/src/fixtures/gpp-2026-vectors.json"
    target.write_text(json.dumps(output, indent=2) + "\n")
