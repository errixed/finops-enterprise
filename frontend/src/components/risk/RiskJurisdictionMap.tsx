"use client";

import { useMemo } from "react";
import {
    ComposableMap,
    Geographies,
    Geography
} from "react-simple-maps";

interface Jurisdiction {
    name: string;
    assessments: number;
    highRisk: number;
    riskRate: number;
}

interface Props {
    jurisdictions: Jurisdiction[];
}

const aliases: Record<string, string> = {
    "united states of america": "united states",
    "usa": "united states",
    "us": "united states",
    "uk": "united kingdom",
    "russian federation": "russia",
    "republic of korea": "south korea",
    "korea, rep.": "south korea",
    "viet nam": "vietnam",
    "czechia": "czech republic",
    "united republic of tanzania": "tanzania"
};

function normalize(value: string) {
    const name = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    return aliases[name] ?? name;
}

export default function RiskJurisdictionMap({
    jurisdictions
}: Props) {
    const countryData = useMemo(
        () => new Map(
            jurisdictions.map(item => [normalize(item.name), item])
        ),
        [jurisdictions]
    );

    const maxAssessments = Math.max(
        1,
        ...jurisdictions.map(item => item.assessments)
    );

    function countryColor(name: string) {
        const item = countryData.get(normalize(name));

        if (!item || item.assessments === 0) {
            return "#d7e8fc";
        }

        const intensity = item.assessments / maxAssessments;

        if (intensity >= 0.65) return "#0645bb";
        if (intensity >= 0.3) return "#317bd8";
        return "#91bdf2";
    }

    return (
        <div className="ran-world-map">
            <ComposableMap
                width={800}
                height={400}
                projection="geoEqualEarth"
                projectionConfig={{
                    scale: 150,
                    center: [0, 5]
                }}
                style={{
                    width: "100%",
                    height: "auto"
                }}
            >
                <Geographies geography="/maps/world.json">
                    {({ geographies }) =>
                        geographies.map(geo => {
                            const properties = geo.properties as Record<
                                string,
                                unknown
                            >;

                            const name = String(
                                properties.name ??
                                properties.NAME ??
                                properties.ADMIN ??
                                properties.NAME_EN ??
                                ""
                            );

                            const item = countryData.get(normalize(name));

                            return (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill={countryColor(name)}
                                    stroke="#ffffff"
                                    strokeWidth={0.45}
                                    style={{
                                        outline: "none",
                                        cursor: "pointer"
                                    }}
                                    className="risk-map-country"
                                >
                                    <title>
                                        {item
                                            ? `${name}: ${item.assessments} assessments, ${item.highRisk} high/critical (${item.riskRate.toFixed(1)}%)`
                                            : `${name}: No recorded assessments`}
                                    </title>
                                </Geography>
                            );
                        })
                    }
                </Geographies>
            </ComposableMap>

            <div className="ran-map-legend">
                <span><i style={{ background: "#d7e8fc" }} /> No data</span>
                <span><i style={{ background: "#91bdf2" }} /> Low</span>
                <span><i style={{ background: "#317bd8" }} /> Medium</span>
                <span><i style={{ background: "#0645bb" }} /> High</span>
            </div>
        </div>
    );
}